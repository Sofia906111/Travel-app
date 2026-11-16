plugins {
    id("com.android.application") version "8.13.0" apply false
    id("org.jetbrains.kotlin.android") version "2.2.20" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.2.20" apply false
    id("com.google.devtools.ksp") version "2.2.20-2.0.3" apply false
}

// Build output goes OUTSIDE the project folder: OneDrive locks files in `build/` while syncing,
// which makes Gradle fail with "Unable to delete directory". Output: ~/AndroidBuilds/AccessibleTravel/
allprojects {
    layout.buildDirectory.set(
        File(System.getProperty("user.home"), "AndroidBuilds/${rootProject.name}/${project.name}"),
    )
}
