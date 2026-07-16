# Native permission inventory

FizyoFlow requests only permissions tied to a user-visible feature.

| Permission | Platform | Feature |
| --- | --- | --- |
| Camera | iOS, Android | Clinic QR, client entry QR and check-in scanning |
| Location while in use | iOS, Android | Nearby-first clinic discovery while the app is open |
| Photo library add / media write | iOS, Android | Saving the clinic QR image to the device gallery without reading the user's library |
| Notifications | iOS, Android | Appointment, approval, package and account notifications |
| Face ID | iOS | Optional biometric sign-in |

The release app does not record audio, draw overlays, track background location or request always-on location. Android's Expo Camera dependency declares audio recording by default, so the release manifest explicitly removes it and the Expo plugin disables it during future prebuilds. `SYSTEM_ALERT_WINDOW` remains limited to the debug and debug-optimized source sets for the development client.

QR export requests write-only media access. iOS keeps only the add-to-library usage description; Android legacy read/write declarations remain for QR export compatibility on older supported Android versions, while modern Android uses scoped media storage without `requestLegacyExternalStorage`.
