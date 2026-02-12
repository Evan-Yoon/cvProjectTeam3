package com.team3.walkmate;

import android.content.res.AssetFileDescriptor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.tensorflow.lite.DataType;
import org.tensorflow.lite.Interpreter;
import org.tensorflow.lite.Tensor;
import org.tensorflow.lite.gpu.GpuDelegate;

import java.io.FileInputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.MappedByteBuffer;
import java.nio.channels.FileChannel;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "NpuTflite")
public class NpuTflitePlugin extends Plugin {

    private Interpreter tflite;
    private GpuDelegate gpuDelegate;
    private static final int MODEL_INPUT_SIZE = 320;
    private static final String TAG = "NpuTflite";

    @PluginMethod
    public void loadModel(PluginCall call) {
        String modelPath = call.getString("modelPath", "best_int8.tflite");
        try {
            if (tflite != null) {
                tflite.close();
                if (gpuDelegate != null) {
                    gpuDelegate.close();
                }
            }

            // 1. Setup GPU Delegate Options
            GpuDelegate.Options options = new GpuDelegate.Options();
            options.setInferencePreference(GpuDelegate.Options.INFERENCE_PREFERENCE_SUSTAINED_SPEED);
            
            // Allow quantized models (e.g. best_int8.tflite) on GPU
            // This allows the GPU delegate to run mixed-precision or quantized models
            options.setQuantizedModelsAllowed(true); 

            gpuDelegate = new GpuDelegate(options);

            // 2. Interpreter Options
            Interpreter.Options interpreterOptions = new Interpreter.Options();
            interpreterOptions.addDelegate(gpuDelegate);

            // 3. Load Model
            MappedByteBuffer tfliteModel = loadModelFile(modelPath);
            tflite = new Interpreter(tfliteModel, interpreterOptions);
            
            // 4. Force Input Shape to [1, 320, 320, 3] to avoid Batch Size Mismatch
            // Some models export with dynamic batch or batch=100 (validation default)
            tflite.resizeInput(0, new int[]{1, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, 3});
            tflite.allocateTensors(); // Important after resize

            Log.i(TAG, "Model loaded successfully with GPU Delegate (Quantized Allowed)");
            
            // Log Input Tensor Details for Debugging
            Tensor inputTensor = tflite.getInputTensor(0);
            Log.i(TAG, "Input Tensor: Type=" + inputTensor.dataType() + ", Shape=" + java.util.Arrays.toString(inputTensor.shape()));

            JSObject ret = new JSObject();
            ret.put("status", "loaded");
            ret.put("delegate", "GPU_Quantized");
            call.resolve(ret);

        } catch (Exception e) {
            Log.e(TAG, "Error loading model", e);
            call.reject("Error loading model: " + e.getMessage());
        }
    }

    @PluginMethod
    public void detect(PluginCall call) {
        if (tflite == null) {
            call.reject("Model not loaded");
            return;
        }

        String imageBase64 = call.getString("image");
        if (imageBase64 == null) {
            call.reject("No image data provided");
            return;
        }

        try {
            byte[] decodedString = Base64.decode(imageBase64, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(decodedString, 0, decodedString.length);
            Bitmap resizedBitmap = Bitmap.createScaledBitmap(bitmap, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, true);

            // Determine Input Type from Model
            Tensor inputTensor = tflite.getInputTensor(0);
            DataType inputType = inputTensor.dataType();

            ByteBuffer inputBuffer;
            if (inputType == DataType.FLOAT32) {
                inputBuffer = convertBitmapToByteBufferFloat(resizedBitmap);
            } else if (inputType == DataType.UINT8) {
                inputBuffer = convertBitmapToByteBufferUint8(resizedBitmap);
            } else {
                 // Fallback to Float (might fail if INT8 strict)
                 Log.w(TAG, "Unknown input type: " + inputType + ". Defaulting to Float32.");
                 inputBuffer = convertBitmapToByteBufferFloat(resizedBitmap);
            }

            // Output Config
            int outputTensorIndex = 0;
            int[] outputShape = tflite.getOutputTensor(outputTensorIndex).shape();
            
             // Handle Output Buffer (Always Float32 for Post-Processing convenience in this app)
             // If model output is quantized, TFLite handles dequantization if we ask for it, 
             // but usually raw output tensor type matches.
             // For simplicity, let's assume detection output is Float32 or we read it as is.
             // Best practice: Read into expected type buffer.
             
            int totalElements = 1;
            for (int dim : outputShape) {
                totalElements *= dim;
            }
            
            // Allocate Output Buffer
            // We assume output is Float32 for detection boxes/scores.
            // If it's Int8, we might need to dequantize manually, but usually Object Detection heads are Float.
            ByteBuffer outputBuffer = ByteBuffer.allocateDirect(totalElements * 4); 
            outputBuffer.order(ByteOrder.nativeOrder());
            
            tflite.run(inputBuffer, outputBuffer);

            outputBuffer.rewind();
            com.getcapacitor.JSArray jsArray = new com.getcapacitor.JSArray();
            for (int i = 0; i < totalElements; i++) {
                jsArray.put(outputBuffer.getFloat());
            }
            
            JSObject ret = new JSObject();
            ret.put("data", jsArray);
            ret.put("shape", new com.getcapacitor.JSArray(getJsonArrayFromIntArray(outputShape)));
            
            call.resolve(ret);

        } catch (Exception e) {
            Log.e(TAG, "Inference error", e);
            call.reject("Inference failed: " + e.getMessage());
        }
    }

    private List<Integer> getJsonArrayFromIntArray(int[] array) {
        List<Integer> list = new ArrayList<>();
        for (int i : array) {
            list.add(i);
        }
        return list;
    }

    private MappedByteBuffer loadModelFile(String modelPath) throws IOException {
        String assetPath = modelPath;
        if (!assetPath.startsWith("public/")) assetPath = "public/" + modelPath;
        if (assetPath.startsWith("assets/")) assetPath = assetPath.substring(7);
        AssetFileDescriptor fileDescriptor = getContext().getAssets().openFd(assetPath);
        FileInputStream inputStream = new FileInputStream(fileDescriptor.getFileDescriptor());
        FileChannel fileChannel = inputStream.getChannel();
        return fileChannel.map(FileChannel.MapMode.READ_ONLY, fileDescriptor.getStartOffset(), fileDescriptor.getDeclaredLength());
    }

    // Float32 Conversion (Original)
    private ByteBuffer convertBitmapToByteBufferFloat(Bitmap bitmap) {
        ByteBuffer byteBuffer = ByteBuffer.allocateDirect(4 * MODEL_INPUT_SIZE * MODEL_INPUT_SIZE * 3);
        byteBuffer.order(ByteOrder.nativeOrder());
        int[] intValues = new int[MODEL_INPUT_SIZE * MODEL_INPUT_SIZE];
        bitmap.getPixels(intValues, 0, bitmap.getWidth(), 0, 0, bitmap.getWidth(), bitmap.getHeight());
        int pixel = 0;
        for (int i = 0; i < MODEL_INPUT_SIZE; ++i) {
            for (int j = 0; j < MODEL_INPUT_SIZE; ++j) {
                final int val = intValues[pixel++];
                byteBuffer.putFloat(((val >> 16) & 0xFF) / 255.0f);
                byteBuffer.putFloat(((val >> 8) & 0xFF) / 255.0f);
                byteBuffer.putFloat((val & 0xFF) / 255.0f);
            }
        }
        return byteBuffer;
    }

    // Uint8 Conversion (For Quantized Models)
    private ByteBuffer convertBitmapToByteBufferUint8(Bitmap bitmap) {
        ByteBuffer byteBuffer = ByteBuffer.allocateDirect(MODEL_INPUT_SIZE * MODEL_INPUT_SIZE * 3);
        byteBuffer.order(ByteOrder.nativeOrder());
        int[] intValues = new int[MODEL_INPUT_SIZE * MODEL_INPUT_SIZE];
        bitmap.getPixels(intValues, 0, bitmap.getWidth(), 0, 0, bitmap.getWidth(), bitmap.getHeight());
        int pixel = 0;
        for (int i = 0; i < MODEL_INPUT_SIZE; ++i) {
            for (int j = 0; j < MODEL_INPUT_SIZE; ++j) {
                final int val = intValues[pixel++];
                byteBuffer.put((byte) ((val >> 16) & 0xFF));
                byteBuffer.put((byte) ((val >> 8) & 0xFF));
                byteBuffer.put((byte) (val & 0xFF));
            }
        }
        return byteBuffer;
    }

    @Override
    protected void handleOnDestroy() {
        if (tflite != null) tflite.close();
        if (gpuDelegate != null) gpuDelegate.close();
    }
}
