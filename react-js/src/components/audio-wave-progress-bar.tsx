import clsx from "clsx";
import { useCallback, useEffect, useRef } from "react";
import { drawWaveform, WaveStyle } from "../helpers/audio-wave";
import { supportsPassiveListeners } from "../helpers/utils";

interface AudioWaveProgressBar {
    onAudioPlay?: () => void;
    onAudioPause?: () => void;
    onAudioToggle?: (params:{paused: boolean, ended:boolean}) => void;
    onAudioTimeupdate?: (params:{currentTimePercentage:number, duration:number, ended:boolean, paused:boolean}) => void;
    onRequestAudioInit?: () => void;
    onAudioEnded?: () => void;
    paused: boolean;
    waveData: number[];
    waveStyle: WaveStyle,
    width: number;
    height: number;
    duration: number;
    currentTimePercentage: number;
    audioUrl: {src: string; type: string;}[];
    className?: string;
}

export default function AudioWaveProgressBar(
    {
        onAudioPlay,
        onAudioPause,
        onAudioToggle,
        onAudioTimeupdate,
        onRequestAudioInit,
        onAudioEnded,
        paused,
        waveData,
        waveStyle,
        width,
        height,
        duration,
        currentTimePercentage,
        audioUrl,
        className
    }:AudioWaveProgressBar
) {
    const progressBarContainer = useRef<HTMLDivElement|null>(null);
    const canvas = useRef<HTMLCanvasElement|null>(null);
    const audioElement = useRef<HTMLAudioElement|null>(null);
    const isSeeking = useRef(false);
    const isCurrentTimeSetManually = useRef(true);
    const isAudioInitiated = useRef(Boolean(audioUrl.length));

    const playAudio = useRef(!paused);
    const audioCurrentTimePercentage = useRef(currentTimePercentage);
    const audioDuration = useRef(duration);
    audioCurrentTimePercentage.current = currentTimePercentage;
    audioDuration.current = duration;
    isAudioInitiated.current = Boolean(audioUrl.length);
    playAudio.current = !paused;

    const getDuration = () => {
        // const _audioElement = audioElement.current;
        // if(!_audioElement) return audioDuration.current;
        // return Infinity === _audioElement.duration || isNaN(_audioElement.duration) ? audioDuration.current : _audioElement.duration;
        return audioDuration.current;
    };


    const setAudioStatus = useCallback((currentTime:number) => {
        if(audioElement.current) {
            if(isCurrentTimeSetManually.current) {
                audioElement.current.currentTime = currentTime;
            }

            if(playAudio.current) {
                if(audioElement.current.paused) {
                    audioElement.current.play();
                }
            }else {
                audioElement.current.pause();
            }
        }
    }, []);

    setAudioStatus(audioCurrentTimePercentage.current * getDuration());

    useEffect(() => {
        if(canvas.current) drawWaveform({waveData, waveStyle, canvas: canvas.current, progressPercentage: audioCurrentTimePercentage.current, fillType: 'adjust'});

        const _audioElement = audioElement.current;
        if(!_audioElement) return void 0;

        isAudioInitiated.current = Boolean(audioUrl.length);
        setAudioStatus(audioCurrentTimePercentage.current * getDuration()); // to load it first time

        const updateProgressBar = () => {
            if(!isSeeking.current && playAudio.current && !_audioElement.ended) {
                const currentTime = _audioElement.currentTime;

                if(!isNaN(currentTime) && !isNaN(getDuration())) {
                    const _canvas = canvas.current;
                    if(!_canvas) return void 0;

                    drawWaveform({waveData, waveStyle, canvas: _canvas, progressPercentage: currentTime/getDuration(), fillType: 'adjust'});
                }
            }

            if(playAudio.current) {
                requestAnimationFrame(updateProgressBar);
            }
        }

        if(playAudio.current) updateProgressBar();

        const onPlay = () => {
            playAudio.current = true;
            onAudioPlay && onAudioPlay();
            onAudioToggle && onAudioToggle({paused: false, ended:_audioElement.ended});
            updateProgressBar();
        }

        const onPause = () => {
            playAudio.current = false;
            onAudioPause && onAudioPause();
            onAudioToggle && onAudioToggle({paused: true, ended:_audioElement.ended});
        }

        const onEnded = () => {
            if(canvas.current && !isSeeking.current) {
                drawWaveform({waveData, waveStyle, canvas: canvas.current, progressPercentage:0, fillType: 'adjust'});
            }
            onAudioEnded && onAudioEnded();
        }

        const onTimeupdate = () => {
            if(!isCurrentTimeSetManually.current) {
                onAudioTimeupdate && onAudioTimeupdate({currentTimePercentage: _audioElement.currentTime / getDuration(), duration: getDuration(), ended:_audioElement.ended, paused: !playAudio.current});
            }
            isCurrentTimeSetManually.current = false;
        }

        _audioElement.addEventListener('play', onPlay);
        _audioElement.addEventListener('pause', onPause);
        _audioElement.addEventListener('ended', onEnded);
        _audioElement.addEventListener('timeupdate', onTimeupdate);

        return () => {
            _audioElement.removeEventListener('play', onPlay);
            _audioElement.removeEventListener('pause', onPause);
            _audioElement.removeEventListener('ended', onEnded);
            _audioElement.removeEventListener('timeupdate', onTimeupdate);
        }
    }, [Boolean(audioUrl.length), onAudioPause, onAudioPlay, onAudioToggle, onAudioTimeupdate, onAudioEnded]);

    useEffect(() => {
        const _progressBarContainer = progressBarContainer.current;
        if(!_progressBarContainer) return void 0;

        let startXPosition = 0;
        let startLayerXPosition = 0;
        let leftPosition = 0;
        const progressBarContainerWidth = _progressBarContainer.offsetWidth;

        let pausedBeforeMousedown = playAudio.current;

        const onMousedown = (event: MouseEvent) => {
            if(event.button !== 0) return void 0;
            pausedBeforeMousedown = !playAudio.current;
            preventDefault(event);
            startXPosition = event.x;
            startLayerXPosition = event.layerX + ((event.target as HTMLElement)?.offsetLeft || 0);

            isSeeking.current = true;
            onMousemove(event);

            window.addEventListener('mouseup', onMouseup);
            window.addEventListener('blur', onMouseup);
            window.addEventListener('mousemove', onMousemove);
        }

        const onMousemove = (event: MouseEvent) => handleMove(event, false);

        const onMouseup = () => {
            isCurrentTimeSetManually.current = true;
            onAudioTimeupdate && onAudioTimeupdate({currentTimePercentage: leftPosition / progressBarContainerWidth, duration: getDuration(), ended:leftPosition / progressBarContainerWidth == 1, paused: pausedBeforeMousedown});
            if(!isAudioInitiated.current) {
                onRequestAudioInit && onRequestAudioInit();
                isAudioInitiated.current = true;
            }

            isSeeking.current = false;
            cleanupEventListeners();
        }

        const onTouchstart = (event:TouchEvent) => {
            preventDefault(event);
            const touch = event.touches[0];
            const rect = (touch.target as HTMLElement).getBoundingClientRect();

            const layerX = touch.clientX - rect.left;

            pausedBeforeMousedown = !playAudio.current;
            startXPosition = touch.clientX;
            startLayerXPosition = layerX;

            isSeeking.current = true;
            onTouchmove(event);

            window.addEventListener('touchend', onTouchend);
            window.addEventListener('blur', onTouchend);
            window.addEventListener('touchmove', onTouchmove, supportsPassiveListeners() ? { passive: false } : {});
        }

        const onTouchmove = (event: TouchEvent) => handleMove(event, true);

        const onTouchend = () => {
            isCurrentTimeSetManually.current = true;
            onAudioTimeupdate && onAudioTimeupdate({currentTimePercentage: leftPosition / progressBarContainerWidth, duration: getDuration(), ended:leftPosition / progressBarContainerWidth == 1, paused: pausedBeforeMousedown});
            if(!isAudioInitiated.current) {
                onRequestAudioInit && onRequestAudioInit();
                isAudioInitiated.current = true;
            }

            isSeeking.current = false;
            cleanupEventListeners();
        }

        const handleMove = (event: MouseEvent | TouchEvent, isTouch: boolean) => {
            preventDefault(event);
            let clientX = isTouch ? (event as TouchEvent).touches[0].clientX : (event as MouseEvent).x;
    
            leftPosition = startLayerXPosition + (clientX - startXPosition);
            leftPosition = Math.max(leftPosition, 0);
            leftPosition = Math.min(leftPosition, progressBarContainerWidth);
    
            const _canvas = canvas.current;
            if (!_canvas) return;
    
            drawWaveform({ waveData, waveStyle, canvas: _canvas, progressPercentage: leftPosition / progressBarContainerWidth, fillType: 'adjust' });
        };

        const preventDefault = (event: Event) => {
            if (event.cancelable) event.preventDefault();
        };

        const cleanupEventListeners = () => {
            window.removeEventListener('mouseup', onMouseup);
            window.removeEventListener('blur', onMouseup);
            window.removeEventListener('mousemove', onMousemove);
            window.removeEventListener('touchend', onTouchend);
            window.removeEventListener('blur', onTouchend);
            window.removeEventListener('touchmove', onTouchmove);
        };

        _progressBarContainer.addEventListener('mousedown', onMousedown);
        _progressBarContainer.addEventListener('touchstart', onTouchstart);

        return () => {
            _progressBarContainer.removeEventListener('mousedown', onMousedown);
            _progressBarContainer.removeEventListener('touchstart', onTouchstart);
            cleanupEventListeners();
        }

    }, []);


    return (
        <>
            <div ref={progressBarContainer} className={clsx("relative flex items-center", className)}>
                <canvas ref={canvas} width={width || 180} height={height || 28}></canvas>
            </div>
            {
                !!audioUrl.length && (
                    <audio ref={audioElement} className="hidden">
                        {
                            audioUrl.map((source, index) => {
                                return <source key={index} src={source.src} type={source.type}></source>
                            })
                        }
                    </audio>
                )
            }
        </>
    )

}