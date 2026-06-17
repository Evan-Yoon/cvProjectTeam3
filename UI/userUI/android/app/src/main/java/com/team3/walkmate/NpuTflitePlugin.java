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

    // ★ [수정됨] 모델 입력 크기를 동적으로 설정
    private int inputHeight = 640;
    private int inputWidth = 640;
    private boolean isNCHW = false;

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

            // 1. Setup Interpreter Options
            Interpreter.Options interpreterOptions = new Interpreter.Options();

            // 2. Try Setup GPU Delegate Options
            // ★ [수정됨] Float32 모델 Native Crash (GL/DSP 버그) 방지를 위해 GPU Delegate 일시적 강제 비활성화
            /*
            try {
                GpuDelegate.Options options = new GpuDelegate.Options();
                options.setInferencePreference(GpuDelegate.Options.INFERENCE_PREFERENCE_SUSTAINED_SPEED);
                options.setQuantizedModelsAllowed(true);
                gpuDelegate = new GpuDelegate(options);
                interpreterOptions.addDelegate(gpuDelegate);
                Log.i(TAG, "GPU Delegate initialized successfully.");
            } catch (Exception e) {
                Log.w(TAG, "GPU Delegate initialization failed. Falling back to CPU. Error: " + e.getMessage());
                if (gpuDelegate != null) {
                    gpuDelegate.close();
                    gpuDelegate = null;
                }
            }
            */

            // ALWAYS Fallback to pure CPU with 4 threads for stability
            interpreterOptions.setNumThreads(4);
            // Removed setUseNNAPI(true) as it is notoriously unstable and causes SIGSEGV on many devices

            // 3. Load Model
            MappedByteBuffer tfliteModel = loadModelFile(modelPath);
            tflite = new Interpreter(tfliteModel, interpreterOptions);

            // 4. Check Input Shape and determine width, height, and layout Dynamically
            int[] currentShape = tflite.getInputTensor(0).shape();
            Log.i(TAG, "Input tensor shape: " + java.util.Arrays.toString(currentShape));
            
            if (currentShape.length == 4) {
                if (currentShape[1] == 3) {
                    isNCHW = true;
                    inputHeight = currentShape[2];
                    inputWidth = currentShape[3];
                } else if (currentShape[3] == 3) {
                    isNCHW = false;
                    inputHeight = currentShape[1];
                    inputWidth = currentShape[2];
                }
            } else {
                Log.w(TAG, "Unexpected input shape dimension: " + currentShape.length);
            }

            Log.i(TAG, "Model loaded properly. Width: " + inputWidth + ", Height: " + inputHeight + ", NCHW: " + isNCHW);

            // Log Input Tensor Details for Debugging
            Tensor inputTensor = tflite.getInputTensor(0);
            Log.i(TAG, "Input Tensor: Type=" + inputTensor.dataType() + ", Shape=" + java.util.Arrays.toString(inputTensor.shape()));

            JSObject ret = new JSObject();
            ret.put("status", "loaded");
            ret.put("delegate", gpuDelegate != null ? "GPU" : "CPU");
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

            // ★ 이미지를 동적으로 추출된 width x height으로 리사이징
            Bitmap resizedBitmap = Bitmap.createScaledBitmap(bitmap, inputWidth, inputHeight, true);

            // Determine Input Type from Model
            Tensor inputTensor = tflite.getInputTensor(0);
            DataType inputType = inputTensor.dataType();

            ByteBuffer inputBuffer;
            if (inputType == DataType.FLOAT32) {
                inputBuffer = convertBitmapToByteBufferFloat(resizedBitmap);
            } else if (inputType == DataType.UINT8) {
                inputBuffer = convertBitmapToByteBufferUint8(resizedBitmap);
            } else {
                 Log.w(TAG, "Unknown input type: " + inputType + ". Defaulting to Float32.");
                 inputBuffer = convertBitmapToByteBufferFloat(resizedBitmap);
            }

            // Output Config dynamically using numBytes
            int outputTensorIndex = 0;
            Tensor outputTensor = tflite.getOutputTensor(outputTensorIndex);
            int[] outputShape = outputTensor.shape();
            int byteSize = outputTensor.numBytes();
            
            // Allocate Output Buffer purely based on exact bytes
            ByteBuffer outputBuffer = ByteBuffer.allocateDirect(byteSize > 0 ? byteSize : 10000000);
            outputBuffer.order(ByteOrder.nativeOrder());

            tflite.run(inputBuffer, outputBuffer);

            outputBuffer.rewind();
            com.getcapacitor.JSArray jsArray = new com.getcapacitor.JSArray();

            DataType outType = outputTensor.dataType();
            if (outType == DataType.FLOAT32) {
                int count = byteSize / 4;
                for (int i = 0; i < count; i++) {
                    jsArray.put(outputBuffer.getFloat());
                }
            } else if (outType == DataType.UINT8) {
                for (int i = 0; i < byteSize; i++) {
                    jsArray.put((float) (outputBuffer.get() & 0xFF));
                }
            } else {
                for (int i = 0; i < byteSize; i++) {
                    jsArray.put((float) outputBuffer.get());
                }
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
        // public 폴더 경로 처리
        if (!assetPath.startsWith("public/")) assetPath = "public/" + modelPath;
        if (assetPath.startsWith("assets/")) assetPath = assetPath.substring(7);

        AssetFileDescriptor fileDescriptor = getContext().getAssets().openFd(assetPath);
        FileInputStream inputStream = new FileInputStream(fileDescriptor.getFileDescriptor());
        FileChannel fileChannel = inputStream.getChannel();
        return fileChannel.map(FileChannel.MapMode.READ_ONLY, fileDescriptor.getStartOffset(), fileDescriptor.getDeclaredLength());
    }

    // Float32 Conversion
    private ByteBuffer convertBitmapToByteBufferFloat(Bitmap bitmap) {
        ByteBuffer byteBuffer = ByteBuffer.allocateDirect(4 * inputWidth * inputHeight * 3);
        byteBuffer.order(ByteOrder.nativeOrder());
        int[] intValues = new int[inputWidth * inputHeight];
        bitmap.getPixels(intValues, 0, bitmap.getWidth(), 0, 0, bitmap.getWidth(), bitmap.getHeight());
        
        if (isNCHW) {
             int area = inputWidth * inputHeight;
             for (int i = 0; i < area; i++) byteBuffer.putFloat(((intValues[i] >> 16) & 0xFF) / 255.0f);
             for (int i = 0; i < area; i++) byteBuffer.putFloat(((intValues[i] >> 8) & 0xFF) / 255.0f);
             for (int i = 0; i < area; i++) byteBuffer.putFloat((intValues[i] & 0xFF) / 255.0f);
        } else {
             for (int val : intValues) {
                 byteBuffer.putFloat(((val >> 16) & 0xFF) / 255.0f);
                 byteBuffer.putFloat(((val >> 8) & 0xFF) / 255.0f);
                 byteBuffer.putFloat((val & 0xFF) / 255.0f);
             }
        }
        return byteBuffer;
    }

    // Uint8 Conversion
    private ByteBuffer convertBitmapToByteBufferUint8(Bitmap bitmap) {
        ByteBuffer byteBuffer = ByteBuffer.allocateDirect(inputWidth * inputHeight * 3);
        byteBuffer.order(ByteOrder.nativeOrder());
        int[] intValues = new int[inputWidth * inputHeight];
        bitmap.getPixels(intValues, 0, bitmap.getWidth(), 0, 0, bitmap.getWidth(), bitmap.getHeight());
        
        if (isNCHW) {
             int area = inputWidth * inputHeight;
             for (int i = 0; i < area; i++) byteBuffer.put((byte) ((intValues[i] >> 16) & 0xFF));
             for (int i = 0; i < area; i++) byteBuffer.put((byte) ((intValues[i] >> 8) & 0xFF));
             for (int i = 0; i < area; i++) byteBuffer.put((byte) (intValues[i] & 0xFF));
        } else {
             for (int val : intValues) {
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