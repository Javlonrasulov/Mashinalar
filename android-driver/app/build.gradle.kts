plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
  id("com.google.dagger.hilt.android")
  id("com.google.devtools.ksp")
}

android {
  namespace = "com.mashinalar.driver"
  compileSdk = 35

  defaultConfig {
    applicationId = "com.mashinalar.driver"
    minSdk = 26
    targetSdk = 35
    versionCode = 1
    versionName = "0.1.0"

    testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
  }

  flavorDimensions += "env"
  productFlavors {
    create("prod") {
      dimension = "env"
      buildConfigField("String", "EMULATOR_BASE_URL", "\"https://mashina.liderplast.uz/\"")
      buildConfigField("String", "DEVICE_BASE_URL", "\"https://mashina.liderplast.uz/\"")
      resValue("string", "app_name", "Mashinalar Driver")
    }
    create("dev") {
      dimension = "env"
      applicationIdSuffix = ".dev"
      versionNameSuffix = "-dev"
      buildConfigField("String", "EMULATOR_BASE_URL", "\"https://dev.mashina.liderplast.uz/\"")
      buildConfigField("String", "DEVICE_BASE_URL", "\"https://dev.mashina.liderplast.uz/\"")
      resValue("string", "app_name", "Mashinalar Driver Dev")
    }
  }

  buildFeatures {
    compose = true
    buildConfig = true
  }
  composeOptions {
    kotlinCompilerExtensionVersion = "1.5.14"
  }

  buildTypes {
    debug {
      // Debug logging is more verbose.
      buildConfigField("Boolean", "HTTP_LOG_BODY", "true")
    }
    release {
      isMinifyEnabled = false
      buildConfigField("Boolean", "HTTP_LOG_BODY", "false")
      proguardFiles(
        getDefaultProguardFile("proguard-android-optimize.txt"),
        "proguard-rules.pro",
      )
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  kotlinOptions {
    jvmTarget = "17"
  }

  packaging {
    resources.excludes += setOf(
      "META-INF/AL2.0",
      "META-INF/LGPL2.1",
    )
  }
}

dependencies {
  // Core
  implementation("androidx.core:core-ktx:1.13.1")
  implementation("androidx.appcompat:appcompat:1.7.0")
  implementation("com.google.android.material:material:1.12.0")
  implementation("androidx.activity:activity-compose:1.9.1")

  // Compose (UI)
  val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
  implementation(composeBom)
  androidTestImplementation(composeBom)
  implementation("androidx.compose.ui:ui")
  implementation("androidx.compose.ui:ui-tooling-preview")
  implementation("androidx.compose.material3:material3")
  implementation("androidx.compose.material:material-icons-extended")
  implementation("androidx.navigation:navigation-compose:2.7.7")
  implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
  implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.4")
  implementation("androidx.compose.runtime:runtime-livedata")
  debugImplementation("androidx.compose.ui:ui-tooling")
  implementation("androidx.hilt:hilt-navigation-compose:1.2.0")

  // Coroutines
  implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

  // DataStore (token storage)
  implementation("androidx.datastore:datastore-preferences:1.1.1")

  // Retrofit + OkHttp
  implementation("com.squareup.retrofit2:retrofit:2.11.0")
  implementation("com.squareup.retrofit2:converter-moshi:2.11.0")
  implementation("com.squareup.okhttp3:okhttp:4.12.0")
  implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
  implementation("com.squareup.moshi:moshi-kotlin:1.15.1")

  // Room (offline queue)
  implementation("androidx.room:room-runtime:2.6.1")
  implementation("androidx.room:room-ktx:2.6.1")
  ksp("androidx.room:room-compiler:2.6.1")

  // WorkManager (background upload)
  implementation("androidx.work:work-runtime-ktx:2.9.1")

  // Location (FusedLocationProvider)
  implementation("com.google.android.gms:play-services-location:21.3.0")

  implementation("io.coil-kt:coil-compose:2.6.0")

  // DI (Hilt)
  implementation("com.google.dagger:hilt-android:2.51.1")
  ksp("com.google.dagger:hilt-android-compiler:2.51.1")
  implementation("androidx.hilt:hilt-work:1.2.0")
  ksp("androidx.hilt:hilt-compiler:1.2.0")

  // Tests (minimal)
  testImplementation("junit:junit:4.13.2")
  androidTestImplementation("androidx.test.ext:junit:1.2.1")
  androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
}

