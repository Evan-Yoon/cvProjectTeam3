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

import org.tensorflow.lite.Interpreter;
import org.tensorflow.lite.nnapi.NnApiDelegate;

import java.io.FileInputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.MappedByteBuffer;
import java.nio.channels.FileChannel;
import java.util.HashMap;
import java.util.Map;

@CapacitorPlugin(name = "NpuTflite")
public class NpuTflitePlugin extends Plugin {

    private Interpreter tflite;
    private NnApiDelegate nnApiDelegate;
    private static final int MODEL_INPUT_SIZE = 320;
    private static final String TAG = "NpuTflite";

    @PluginMethod
    public void loadModel(PluginCall call) {
        String modelPath = call.getString("modelPath", "best_int8.tflite"); // Default to strict name
        try {
            // Check if model already loaded
            if (tflite != null) {
                tflite.close();
                if (nnApiDelegate != null) {
                    nnApiDelegate.close();
                }
            }

            // Init NNAPI Delegate
            NnApiDelegate.Options options = new NnApiDelegate.Options();
            options.setAllowFp16(true); // Allow FP16 execution if supported
            nnApiDelegate = new NnApiDelegate(options);

            // Init Interpreter Options
            Interpreter.Options interpreterOptions = new Interpreter.Options();
            interpreterOptions.addDelegate(nnApiDelegate);
            interpreterOptions.setUseXNNPACK(true); // Fallback to XNNPACK if NNAPI fails or for unsupported ops

            // Load Model File
            MappedByteBuffer tfliteModel = loadModelFile(modelPath);
            tflite = new Interpreter(tfliteModel, interpreterOptions);

            Log.i(TAG, "Model loaded successfully with NNAPI Delegate");
            
            // Return success with input shape info (optional)
            JSObject ret = new JSObject();
            ret.put("status", "loaded");
            ret.put("delegate", "NNAPI");
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
            // 1. Decode Base64
            byte[] decodedString = Base64.decode(imageBase64, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(decodedString, 0, decodedString.length);

            // 2. Resize
            Bitmap resizedBitmap = Bitmap.createScaledBitmap(bitmap, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, true);

            // 3. Convert to ByteBuffer (Float32)
            ByteBuffer inputBuffer = convertBitmapToByteBuffer(resizedBitmap);

            // 4. Run Inference
            // Output shape depends on model. Assuming [1, 5, 2100] or similar flat array output
            // We'll allocate a large enough buffer or use the model's output tensor shape
            // For flexibility, let's look at the output tensor.
            
            int outputTensorIndex = 0;
            int[] outputShape = tflite.getOutputTensor(outputTensorIndex).shape();
            
            // Calculate total elements
            int totalElements = 1;
            for (int dim : outputShape) {
                totalElements *= dim;
            }

            float[][] output = new float[1][totalElements]; // Provide specific shape or flat?
            // TFLite usually expects specific shape in Java. 
            // If output is [1, 5, 2100], we need float[1][5][2100].
            // To be generic, let's use a flat buffer or Object map.
            
            // Simplest for generic: use a Map<Integer, Object> if we don't know exact shape, 
            // BUT simpler is to let TFLite fill a ByteBuffer or a flat float array if shaped correctly.
            // Let's assume the user knows the shape and we return the flat float array via JS.
            
            // Actually, safest is to use the exact shape.
            // But since this is a specific app for "best_int8.tflite", we likely have [1, 5, 2100] (transposed) or [1, 2100, 5].
            // Let's use a Map to handle outputs.
            Map<Integer, Object> outputs = new HashMap<>();
            // We need to know the output size.
            // Let's just use a ByteBuffer for output to be safe and efficient.
            ByteBuffer outputBuffer = ByteBuffer.allocateDirect(totalElements * 4);
            outputBuffer.order(ByteOrder.nativeOrder());
            
            tflite.run(inputBuffer, outputBuffer);

            // 5. Return Result
            outputBuffer.rewind();
            float[] floatArray = new float[totalElements];
            outputBuffer.asFloatBuffer().get(floatArray);

            JSObject ret = new JSObject();
            // Convert to JS Array (allows JS to reshape)
            // Passing large array might be slow, but it's the bridge cost.
            // We can return it as a JSON array.
            
            // To optimize, we could return a Base64 string of the bytes, but JS array is easier to debug.
            // Capacitor JSObject supports arrays.
             
            // Using a simpler JSON serialization for the array
            // Optimization: Detect if large, maybe just return top K here?
            // No, user wants "NPU Environment", logic in JS.
            
            // Convert float[] to JSON array manually or via JSObject put
            // JSObject.put with array works.
            
            // NOTE: Large arrays in Capacitor/JSON can be slow. 
            // 2100 * 5 = 10500 floats = 40KB. Should be fine.
            
            // Convert float[] to JsonArray
            com.getcapacitor.JSArray jsArray = new com.getcapacitor.JSArray();
            for (float f : floatArray) {
                jsArray.put(f);
            }
            
            ret.put("data", jsArray);
            ret.put("shape", new com.getcapacitor.JSArray(outputShape));
            
            call.resolve(ret);

        } catch (Exception e) {
            Log.e(TAG, "Inference error", e);
            call.reject("Inference failed: " + e.getMessage());
        }
    }

    private MappedByteBuffer loadModelFile(String modelPath) throws IOException {
        // Tries to load from assets
        // Removing "assets/" prefix if present as getAssets() assumes it
        if (modelPath.startsWith("assets/")) {
             modelPath = modelPath.substring(7);
        }
        
        // Open file from assets/public/ if simply filename is given (e.g. best_int8.tflite)
        // because Vite/Capacitor puts web assets in public/ usually.
        // Wait, capacitor copies `dist/` to `android/app/src/main/assets/public/`.
        // So if model is in `public/best_int8.tflite` in web, it's at `public/best_int8.tflite` in Android assets.
        
        AssetFileDescriptor fileDescriptor = getContext().getAssets().openFd("public/" + modelPath);
        FileInputStream inputStream = new FileInputStream(fileDescriptor.getFileDescriptor());
        FileChannel fileChannel = inputStream.getChannel();
        long startOffset = fileDescriptor.getStartOffset();
        long declaredLength = fileDescriptor.getDeclaredLength();
        return fileChannel.map(FileChannel.MapMode.READ_ONLY, startOffset, declaredLength);
    }

    private ByteBuffer convertBitmapToByteBuffer(Bitmap bitmap) {
        ByteBuffer byteBuffer = ByteBuffer.allocateDirect(4 * MODEL_INPUT_SIZE * MODEL_INPUT_SIZE * 3);
        byteBuffer.order(ByteOrder.nativeOrder());
        int[] intValues = new int[MODEL_INPUT_SIZE * MODEL_INPUT_SIZE];
        bitmap.getPixels(intValues, 0, bitmap.getWidth(), 0, 0, bitmap.getWidth(), bitmap.getHeight());
        int pixel = 0;
        for (int i = 0; i < MODEL_INPUT_SIZE; ++i) {
            for (int j = 0; j < MODEL_INPUT_SIZE; ++j) {
                final int val = intValues[pixel++];
                // Normalization: (val - mean) / std ?
                // JS code was: .div(255).
                // So [0, 255] -> [0.0, 1.0]
                
                // R
                byteBuffer.putFloat(((val >> 16) & 0xFF) / 255.0f);
                // G
                byteBuffer.putFloat(((val >> 8) & 0xFF) / 255.0f);
                // B
                byteBuffer.putFloat((val & 0xFF) / 255.0f);
            }
        }
        return byteBuffer;
    }
    
    @Override
    protected void handleOnDestroy() {
        if (tflite != null) tflite.close();
        if (nnApiDelegate != null) nnApiDelegate.close();
    }
}
