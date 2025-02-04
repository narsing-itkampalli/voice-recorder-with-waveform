export type WaveStyle = {
    baseColor: string;
    progressColor: string;
    seekDotColor: string;
    barWidth: number;
    minimumGap: number;
    seekDotSize: number;
    horizontalPadding: number;
    verticalPadding: number
};

export function drawWaveform({waveData, waveStyle, canvas, progressPercentage, fillType}:{waveData:number[], waveStyle:WaveStyle, canvas:HTMLCanvasElement, progressPercentage:number, fillType:'crop'|'adjust'}) {
    const ctx = canvas.getContext('2d');
    if(!ctx) return false;

    const {
        barWidth,
        minimumGap,
        horizontalPadding,
        verticalPadding,
        baseColor,
        progressColor,
        seekDotSize,
        seekDotColor
    } = waveStyle;

    const drawableWidth = canvas.width - horizontalPadding * 2;
    const drawableHeight = canvas.height - verticalPadding * 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if(fillType === 'adjust') {
        waveData = adjustWaveData(waveData, Math.floor(drawableWidth / (barWidth + minimumGap)));
    }else {
        if(waveData.length > Math.floor(drawableWidth / (barWidth + minimumGap))) {
            waveData = waveData.slice(waveData.length - Math.floor(drawableWidth / (barWidth + minimumGap)), waveData.length);
        }

        if(waveData.length < Math.floor(drawableWidth / (barWidth + minimumGap))) {
            waveData = new Array(Math.floor(drawableWidth / (barWidth + minimumGap)) - waveData.length).fill(NaN).concat(waveData);
        }
    }

    
    const adjustedGap = 
        minimumGap + 
        (drawableWidth - (waveData.length * (barWidth + minimumGap))) / 
        waveData.length; // Distribute extra space evenly between gaps

    let maxWaveValue = 0;
    const peaksLength = waveData.length;

    for(let i = 1; i < peaksLength; i++) {
        if(isNaN(waveData[i])) continue;
        if(Math.abs(waveData[i]) > Math.abs(maxWaveValue)) {
            maxWaveValue = waveData[i];
        }
    }

    const drawBars = (start:number, end:number, color:string) => {

        ctx.beginPath();
        for(let index = start; index <= end; index++) {
            const waveDataPoint = Math.abs(waveData[index]);
            if(isNaN(waveDataPoint)) continue;

            const xPosition = horizontalPadding + adjustedGap / 2 + 
                              (index * (barWidth + adjustedGap)) + (barWidth / 2);
    
            const barHeight = drawableHeight * waveDataPoint;
    
            const centerY = canvas.height / 2;
            const yStart = centerY - barHeight / 2;
            const yEnd = centerY + barHeight / 2;
    
            // Begin drawing the waveform
            ctx.moveTo(xPosition, yStart);
            ctx.lineTo(xPosition, yEnd);
        }
    
        ctx.lineCap = 'round';
        ctx.strokeStyle = color;
        ctx.lineWidth = barWidth;
        ctx.stroke();
    }

    if(isNaN(progressPercentage)) {
        drawBars(0, waveData.length - 1, baseColor);
    }else {
        drawBars(0, Math.floor(waveData.length * progressPercentage), progressColor);
        drawBars(Math.floor(waveData.length * progressPercentage) + 1, waveData.length - 1, baseColor);
    }

    // Begin drawing the dot
    ctx.beginPath();

    const arcXPosition = horizontalPadding + (drawableWidth * progressPercentage);

    ctx.arc(arcXPosition, canvas.height / 2, (seekDotSize / 2), 0, 2 * Math.PI);
    ctx.fillStyle = seekDotColor;
    ctx.fill();
}

export function adjustWaveData(inputData:number[], targetPeaksCount:number) {
    const totalDataPoints = inputData.length;

    if (targetPeaksCount === totalDataPoints) return inputData;

    if(targetPeaksCount > totalDataPoints) {
        const additionalDataNeeded = targetPeaksCount - totalDataPoints;
        const fullRepeats = Math.floor(additionalDataNeeded / totalDataPoints);
        let remainingRepeats = additionalDataNeeded % totalDataPoints;

        return inputData.map(dataPoint => {
            const repeatCount = fullRepeats + 1 + (remainingRepeats > 0 ? 1 : 0);
            const repeatedData = new Array(repeatCount).fill(dataPoint);
            if (remainingRepeats > 0) remainingRepeats--;
            return repeatedData;
        }).flat();
    }

    const baseChunkSize = Math.floor(totalDataPoints / targetPeaksCount);
    let extraSamples = totalDataPoints - (baseChunkSize * targetPeaksCount);

    const extraSamplesStartIndex = Math.floor((targetPeaksCount - extraSamples) / 2);

    const peakValues = [];
    let currentIndex = 0;

    for (let peakIndex = 0; peakIndex < targetPeaksCount; peakIndex++) {
        const currentChunkSize = baseChunkSize + ((peakIndex > extraSamplesStartIndex && extraSamples > 0) ? 1 : 0);
        const currentChunk = inputData.slice(currentIndex, currentIndex + currentChunkSize);

        let maxAmplitude = 0;
        const chunkLength = currentChunk.length;
        for (let i = 0; i < chunkLength; i++) {
            maxAmplitude = Math.max(maxAmplitude, Math.abs(currentChunk[i]));
        }

        peakValues.push(maxAmplitude);
        currentIndex += currentChunkSize;
        if (peakIndex > extraSamplesStartIndex) {
            extraSamples--;
        }
    }

    return peakValues;
}