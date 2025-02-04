export async function hasAudioDevice() {
    return await navigator.mediaDevices.enumerateDevices().then((devices) => {
        return devices.some(device => {
            return device.kind === 'audioinput' && Boolean(device.deviceId);
        })
    }).catch(() => false);
}