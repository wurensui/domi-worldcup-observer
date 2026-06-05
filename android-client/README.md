# 世界杯赛事观察室 Android App

这是客户端安卓壳，安装后会直接打开 `MainActivity.java` 里配置的客户页面。打包前请把 `CLIENT_URL` 替换成你自己的地址，例如：

`https://your-domain.example/worldcup-board`

## 打包 APK

1. 安装 Android Studio。
2. 用 Android Studio 打开本文件夹：`android-client`。
3. 等待 Gradle 同步完成。
4. 菜单选择 `Build` -> `Build Bundle(s) / APK(s)` -> `Build APK(s)`。
5. 生成的 APK 在 `app/build/outputs/apk/debug/app-debug.apk`。

也可以在命令行打包：

```bash
cd android-client
./gradlew assembleDebug
```

如果提示找不到 Android SDK，需要先安装 Android Studio 并完成 SDK 安装。

## 修改客户端网址

如果以后换域名，修改：

`app/src/main/java/com/domi/worldcupobserver/MainActivity.java`

里面的 `CLIENT_URL`。
