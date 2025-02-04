import audioBufferToWav from 'audiobuffer-to-wav';

export default async function mergeAudioBlobs(blobs:Blob[], mimeType = 'audio/wav') {
    const audioContext = new AudioContext();

    const audioBuffers = [];
    for (const blob of blobs) {
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        audioBuffers.push(audioBuffer);
    }

    const totalLength = audioBuffers.reduce((sum, buffer) => sum + buffer.length, 0);
    const numberOfChannels = Math.max(...audioBuffers.map(buffer => buffer.numberOfChannels));
    const sampleRate = audioBuffers[0].sampleRate;
    const mergedBuffer = audioContext.createBuffer(numberOfChannels, totalLength, sampleRate);

    let offset = 0;
    for (const buffer of audioBuffers) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
            const channelData = buffer.getChannelData(channel);
            mergedBuffer.getChannelData(channel).set(channelData, offset);
        }
        offset += buffer.length;
    }

    return await encodeAudioBufferToBlob(mergedBuffer, mimeType);
}

// Function to encode AudioBuffer to Blob
async function encodeAudioBufferToBlob(audioBuffer:AudioBuffer, mimeType:string) {
    const offlineAudioContext = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
    );

    const source = offlineAudioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineAudioContext.destination);
    source.start(0);

    const renderedBuffer = await offlineAudioContext.startRendering();

    const wavBlob = await audioBufferToWavBlob(renderedBuffer);
    return new Blob([wavBlob], { type: mimeType });
}

async function audioBufferToWavBlob(audioBuffer:AudioBuffer) {
    const wavData = audioBufferToWav(audioBuffer);
    return new Uint8Array(wavData);
}