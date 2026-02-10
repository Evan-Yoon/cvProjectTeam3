plugins {
    id("com.android.application")
    id("kotlin-android")
    // Flutter Gradle 플러그인은 Android 및 Kotlin Gradle 플러그인 뒤에 적용해야 합니다.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "com.example.flutter_application_choihyunseok"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        // TODO: 고유한 Application ID를 지정하세요 (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.example.flutter_application_choihyunseok"
        // 애플리케이션 요구 사항에 맞게 다음 값을 업데이트할 수 있습니다.
        // 자세한 내용은 다음을 참조하세요: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    buildTypes {
        release {
            // TODO: 릴리스 빌드에 대한 자체 서명 구성을 추가하세요.
            // 현재는 `flutter run --release`가 작동하도록 디버그 키로 서명하고 있습니다.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

flutter {
    source = "../.."
}
