export function formatDuration(seconds:number, padMinutes:boolean = false) {
    // Ensure input is a non-negative integer
    seconds = Math.max(0, Math.floor(seconds));

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    // Format parts with leading zero if needed
    const formattedSeconds = secs.toString().padStart(2, '0');
    const formattedMinutes = minutes.toString().padStart(2, '0');

    // Determine the output format
    if (hours > 0) {
        return `${hours}:${formattedMinutes}:${formattedSeconds}`;
    } else if (minutes > 0 || padMinutes) {
        return `${minutes}:${formattedSeconds}`;
    } else {
        return `${formattedSeconds}`;
    }
}

export function pendingAudioDuration(duration:number, elapsed:number) {
    const pendingDuration = duration - elapsed;
    return `- ${formatDuration(pendingDuration, true)}`;
}