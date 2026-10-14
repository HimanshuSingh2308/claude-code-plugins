# Godot native mobile export

Godot exports natively to Android and iOS, and **that native export is the mobile route for a
standalone Godot game**. Do not wrap a standalone game's web export in Capacitor. The only case
for the Capacitor WebView route is a Weekly Arcade game that must ship inside the WA Capacitor
apps (WA only, see [web-export.md](web-export.md) section 6). Load `game-context` to know which
case you are in.

Everything below was measured on 2026-10-14 with Godot 4.7.2.stable (official macOS build),
its official export templates, Xcode 26.0.1 and an Apple silicon Mac, running every step
headless. Where the docs and the 4.7.2 templates disagree, the templates win; they are what
actually builds.

Sources: https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_android.html ,
https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_ios.html , and the 4.7.2
template `android_source.zip` (`config.gradle`).

## Export presets

One preset per output, as `[preset.N]` sections in `export_presets.cfg` (or Project > Export).
The preset name is what `--export-release "<name>"` refers to.

- **Preset indices must be contiguous** (`preset.0`, `preset.1`, ...). A gap (`preset.0`,
  `preset.1`, `preset.3`) makes every preset after it invisible: the CLI says
  `ERROR: Invalid export preset name: iOS.`
- **One Android preset cannot produce both an APK and an AAB.** `gradle_build/export_format=1`
  (AAB) rejects a `.apk` path (`Invalid filename! Android App Bundle requires the *.aab
  extension.`). Keep two presets: `Android` (APK, sideload and emulator testing) and
  `Android AAB` (Play Store).
- Add `exclude_filter="build/*"` (or wherever exports land) so old exports are not packed into the
  next one.
- Options not written in the preset take their defaults; the keys below are the ones that
  mattered.

```ini
[preset.1]

name="Android"
platform="Android"
runnable=true
export_filter="all_resources"
include_filter=""
exclude_filter="build/*"
export_path="build/android/game.apk"

[preset.1.options]

gradle_build/use_gradle_build=false
gradle_build/export_format=0
architectures/arm64-v8a=true
architectures/armeabi-v7a=false
architectures/x86=false
architectures/x86_64=false
package/unique_name="com.example.mygame"
package/name="My Game"
package/signed=true
version/code=1
version/name="1.0"

[preset.2]

name="Android AAB"
platform="Android"
runnable=true
export_filter="all_resources"
include_filter=""
exclude_filter="build/*"
export_path="build/android/game.aab"

[preset.2.options]

gradle_build/use_gradle_build=true
gradle_build/export_format=1
architectures/arm64-v8a=true
architectures/armeabi-v7a=false
architectures/x86=false
architectures/x86_64=false
package/unique_name="com.example.mygame"
package/name="My Game"
package/signed=true
version/code=1
version/name="1.0"

[preset.3]

name="iOS"
platform="iOS"
runnable=true
export_filter="all_resources"
include_filter=""
exclude_filter="build/*"
export_path="build/ios/game.ipa"

[preset.3.options]

application/app_store_team_id="ABCDE12345"
application/bundle_identifier="com.example.mygame"
application/short_version="1.0"
application/version="1"
application/export_method_debug=1
application/export_method_release=0
application/export_project_only=true
architectures/arm64=true
```

Do not put keystore passwords in `export_presets.cfg` (it is committed). Pass them as
environment variables (below).

## Version numbers on release

`/game-release` bumps these together on every release:

| Where | Key | Rule |
|---|---|---|
| `project.godot` | `application/config/version` | The human version, e.g. `1.2.0` |
| Android preset | `version/name` | Same as the human version |
| Android preset | `version/code` | Integer, +1 every release (the Play Store rejects a reused code) |
| iOS preset | `application/short_version` | Same as the human version |
| iOS preset | `application/version` | Build number, +1 every release |

## Android (native)

### Toolchain that 4.7.2 actually needs

The docs page still lists platform 35, build-tools 35.0.1, NDK r28b and CMake 3.10.2. The 4.7.2
template's `config.gradle` says otherwise, and the export follows the template:

| Item | 4.7.2 template value | Needed for |
|---|---|---|
| JDK | 17 minimum (`validateJavaVersion` task); docs recommend 17 | debug keystore generation, Gradle build |
| Android Gradle Plugin / Gradle | AGP 8.6.1, Gradle wrapper 8.11.1 (downloaded on first build) | Gradle build |
| compileSdk / targetSdk / minSdk | 36 / 36 / 24 | Gradle build, manifest |
| build-tools | **36.1.0** | apksigner and zipalign (both export paths) |
| platform | `platforms;android-36` | Gradle build |
| NDK | 29.0.14206865 (`ndkVersion`) | **optional**: without it Gradle logs `Unable to strip the following libraries, packaging them as they are` and still succeeds; the template `.so` files are already release builds |

Without build-tools matching targetSdk 36, Godot prints `Could not find version of build tools
that matches Target SDK, using 30.0.3` and falls back to the oldest installed build-tools.

Install (macOS, arm64 Homebrew; an existing Android Studio SDK at `~/Library/Android/sdk` works
as the SDK root, and `brew install --cask android-commandlinetools` is only needed if there is
no SDK at all):

```bash
arch -arm64 /opt/homebrew/bin/brew install openjdk@17          # 17.0.20.1 measured, ~305 MB
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
SDK=~/Library/Android/sdk
yes | "$SDK/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$SDK" \
  "platform-tools" "build-tools;36.1.0" "platforms;android-36" "cmdline-tools;latest"
# optional, silences the strip warning: "ndk;29.0.14206865"
```

Measured cost: build-tools 36.1.0 192 MB, platform-tools 37.0.1 37 MB, Gradle caches about
3 GB after the first Gradle build (shared with any other Android project on the machine).

### Editor settings (headless)

The CLI export reads `~/Library/Application Support/Godot/editor_settings-4.7.tres`. Edit it
while no Godot editor is running (the editor rewrites it on exit):

```
export/android/java_sdk_path = "/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
export/android/android_sdk_path = "/Users/<you>/Library/Android/sdk"
```

The path is the JDK home (the folder with `bin/java`), not `/opt/homebrew/opt/openjdk@17`
itself. **The debug keystore is generated automatically**: the first headless export with
`java_sdk_path` set created `~/Library/Application Support/Godot/keystores/debug.keystore`
(password `android`, already referenced by `export/android/debug_keystore`). No manual `keytool`
step is needed for debug.

### Project setting

Android export refuses to run without ETC2/ASTC textures:
`ETC2/ASTC texture compression is required for Android export.` Add to `project.godot`:

```ini
[rendering]

textures/vram_compression/import_etc2_astc=true
```

### Release keystore

```bash
keytool -genkeypair -v -keystore release.keystore -alias mygame -keyalg RSA -keysize 2048 \
  -validity 10000 -storepass "$PASS" -keypass "$PASS" -dname "CN=My Game,O=Me,C=US"
```

Store and key passwords must match. Keep the keystore out of the repo. Feed it to the export
through the environment, which works headless and keeps secrets out of `export_presets.cfg`:

```bash
export GODOT_ANDROID_KEYSTORE_RELEASE_PATH=/abs/path/release.keystore
export GODOT_ANDROID_KEYSTORE_RELEASE_USER=mygame          # the alias
export GODOT_ANDROID_KEYSTORE_RELEASE_PASSWORD="$PASS"
```

### Export commands

```bash
mkdir -p build/android
# APK, no Gradle (about 3 s after import): debug-signed, for emulator or sideload
"$GODOT" --headless --path . --export-debug "Android" build/android/game-debug.apk

# AAB via Gradle. --install-android-build-template unpacks android_source.zip into res://android/
# headlessly (the CLI equivalent of Project > Install Android Build Template); it only needs to be
# passed on the first export. First build about 75 s (Gradle download), later builds about 15 s.
"$GODOT" --headless --path . --install-android-build-template --export-release "Android AAB" build/android/game.aab
```

- The template lands in `res://android/build/` (with a `.gdignore`, so it is not imported). Add
  `/android/` to `.gitignore` (the official Godot gitignore already does).
- Headless output hides Gradle's own log. Add `--verbose` to see the exact `gradlew ...
  bundleStandardRelease` command and Gradle's warnings.
- Harmless warnings on 4.7.2: AGP 8.6.1 "was tested up to compileSdk = 35", the
  `android.overridePathCheck` experimental note, the NDK strip note above.

### Validate

```bash
BT=~/Library/Android/sdk/build-tools/36.1.0
"$BT/apksigner" verify --verbose --print-certs build/android/game-debug.apk   # Verifies, v2 + v3
"$BT/aapt2" dump badging build/android/game-debug.apk | grep -E "^package|SdkVersion|native-code"
jarsigner -verify build/android/game.aab                                      # jar verified
bundletool dump manifest --bundle build/android/game.aab                      # brew install bundletool
```

`aapt2 dump badging` cannot read an `.aab` (`could not identify format of APK`); use bundletool.
Measured on a small 2D project: debug APK 29.9 MB (arm64 only, `libgodot_android.so` 76 MB
uncompressed), release AAB 28.1 MB, `minSdkVersion 24`, `targetSdkVersion 36`.

### Run on an emulator or device

```bash
EMU=~/Library/Android/sdk/emulator/emulator; ADB=~/Library/Android/sdk/platform-tools/adb
"$EMU" -avd <arm64 AVD> -no-window -no-audio -no-boot-anim -no-snapshot -gpu swiftshader_indirect &
until [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ]; do sleep 5; done
"$ADB" install -r build/android/game-debug.apk
"$ADB" shell monkey -p com.example.mygame -c android.intent.category.LAUNCHER 1
"$ADB" logcat -d | grep -E "Godot Engine v|OpenGL API| E godot"
# AAB: bundletool build-apks --bundle=game.aab --output=game.apks --connected-device --ks=... then
#      bundletool install-apks --apks=game.apks
"$ADB" emu kill
```

Measured: an API 33 arm64 AVD booted headless in about 30 s; both the debug APK and the
bundletool-installed release AAB logged `Godot Engine v4.7.2.stable.official.ed1daf0bf` and
`OpenGL API OpenGL ES 3.1 ... - Compatibility` with no `E godot` lines. The Compatibility renderer
runs on the emulator's SwiftShader GPU.

## iOS (native)

### Requirements

macOS, Xcode (26.0.1 measured), the 4.7.2 `ios.zip` template, a 10-character Team ID in
`application/app_store_team_id` and a reverse-DNS `application/bundle_identifier`. The export
directory must be empty or Godot refuses (`Unexpected files found in the export destination
directory`).

### What the export does

- `application/export_project_only=true` with a `.xcodeproj` path: writes `game.xcodeproj`,
  `game/`, `game.pck`, `game.xcframework`, `MoltenVK.xcframework` and `PrivacyInfo.xcprivacy` in
  about 5 s. Expect about 430 MB on disk (the xcframeworks). Always works without signing.
- `export_project_only=false` with a `.ipa` path: the same, then Godot runs
  `xcodebuild -project game.xcodeproj -scheme game -sdk iphoneos -configuration <Debug|Release>
  -destination generic/platform=ios archive -allowProvisioningUpdates -archivePath game.xcarchive`
  and `xcodebuild -exportArchive` with the template's `export_options.plist` (method, teamID,
  `provisioningProfiles` only).

### Signing traps (measured)

- **Setting `provisioning_profile_uuid_*` switches that configuration to Manual signing.** With
  an Xcode-managed profile (any "iOS Team Provisioning Profile: ..." Xcode created, including the
  wildcard `*` one) the archive fails: `Provisioning profile "iOS Team Provisioning Profile: *" is
  Xcode managed, but signing settings require a manually managed profile.` A UUID only works with
  a manually created (developer portal) profile.
- **Leaving the UUID empty means Automatic signing with `-allowProvisioningUpdates`**, which lets
  Xcode register the bundle ID and create or refresh profiles in the team's Apple account. Do not
  run that unless the user has approved changes to their Apple account.
- Godot reports a failed archive as `Failed to run xcodebuild with code 0`; read the `error:`
  line above it.

### The route that worked without touching the Apple account

Export the project only, then archive and export the IPA yourself without
`-allowProvisioningUpdates`. Automatic signing then uses only profiles already on the Mac (here
the team's wildcard `iOS Team Provisioning Profile: *`):

```bash
mkdir -p build/ios
"$GODOT" --headless --path . --export-debug "iOS" build/ios/game.xcodeproj   # export_project_only=true
cd build/ios
xcodebuild -project game.xcodeproj -scheme game -sdk iphoneos -configuration Debug \
  -destination generic/platform=iOS archive -archivePath ../ios-out/game.xcarchive \
  CODE_SIGN_STYLE=Automatic PROVISIONING_PROFILE= PROVISIONING_PROFILE_SPECIFIER= \
  DEVELOPMENT_TEAM=ABCDE12345 CODE_SIGN_IDENTITY="Apple Development"
# ExportOptions.plist: method=debugging (Xcode 15.3+ name for development), teamID, signingStyle=automatic
xcodebuild -exportArchive -archivePath ../ios-out/game.xcarchive -exportPath ../ios-out/ipa \
  -exportOptionsPlist ExportOptions.plist
```

Measured: archive about 20 s, `game.ipa` 25.7 MB, signed `Apple Development`, TeamIdentifier
matching. App Store builds use `method=app-store-connect` and a distribution identity; uploading
is done through Xcode Organizer or Transporter, never from an agent without the user.

### Simulator: does not run on Apple silicon with official 4.7.2 templates

The template's `libgodot.a` simulator slice (`game.xcframework/ios-arm64_x86_64-simulator`) is
**x86_64 only** despite the folder name (`lipo -info`). A default simulator build fails to link
(`Undefined symbols for architecture arm64: "_main"`). Building with `ARCHS=x86_64
ONLY_ACTIVE_ARCH=NO CODE_SIGNING_ALLOWED=NO` succeeds, but the iOS 26 simulator runtime refuses to
install it (`"..." Needs to Be Updated ... Failed to find matching arch`). So on Apple silicon with
Xcode 26, test iOS on a physical device (development-signed IPA via `xcrun devicectl device
install app`), or build custom templates with an arm64 simulator slice. The Compatibility
renderer is the one the simulator would use; the Mobile renderer needs Metal via MoltenVK on
device.

## Renderer

Prefer Compatibility for broad phone support (it is what ran on the emulator above), or Mobile
for newer devices. Forward+ is desktop only.
