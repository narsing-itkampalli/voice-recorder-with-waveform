import { Icon } from "@iconify/react/dist/iconify.js";
import { useCallback, useEffect, useRef, useState } from "react";
import AudioWaveProgressBar from "../components/audio-wave-progress-bar";
import clsx from "clsx";
import mergeAudioBlobs from "../helpers/merge-audio-blob";
import { adjustWaveData, drawWaveform } from "../helpers/audio-wave";
import { formatDuration } from "../helpers/format-duration";

interface VoiceRecorder {
    stopped: boolean;
    stop: Function;
    audioChunks: Blob[];
    waveformSamples: number[];
    duration: number;
}

interface VoiceRecorderModal {
    onDeleted?: () => void;
    onSubmit?: () => void;
}

export default function VoiceRecorderModal({onDeleted}:VoiceRecorderModal) {
    const voiceRecorderList = useRef<VoiceRecorder[]>([]);
    const startVoiceRecording = useRef<Function>(() => {});
    const [isRecording, setIsRecording] = useState(true);
    const isRecordingRef = useRef(isRecording);
    const generatedAudioUrl = useRef<[{type: string, src: string}]|null>(null);
    const finalAudioBlob = useRef<Blob|null>(null);

    isRecordingRef.current = isRecording;
    
    const recordingWaveStyle = {
        baseColor: "#bdbdbd",
        progressColor: '#ffffff',
        seekDotColor: '#ffffff',
        barWidth: 2,
        horizontalPadding: 6,
        verticalPadding: 2,
        minimumGap: 2,
        seekDotSize: 12
    }

    const [audio, setAudio] = useState({
        paused: true,
        currentTimePercentage: 0,
        duration: 0,
        audioInitiated: false,
        audioUrl: [] as { type: string, src: string }[]
    });

    const [recordingTime, setRecordingTime] = useState(0);

    const viewRecordingCanvas = useRef<HTMLCanvasElement | null>(null);

    const deleteRecordingHandler = () => {
        voiceRecorderList.current.forEach((voiceRecorder) => {
            voiceRecorder.stop();
        });
        onDeleted && onDeleted();
    }

    const onRecordingDurationUpdate = useCallback(({duration}:{duration:number}) => {
        setRecordingTime(duration);
    }, []);

    useEffect(() => {
        let autoStopped = false;

        const startRecording = async () => {
            generatedAudioUrl.current = null;
            setAudio((currentState) => ({...currentState, paused: true, currentTimePercentage: 0, audioInitiated: false, audioUrl: []}));
            setIsRecording(true);

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const downsampledWaveform:number[] = [];
            const waveformSamples:VoiceRecorder['waveformSamples'] = [];
            const mediaRecorder = new MediaRecorder(stream);
            const audioChunks:VoiceRecorder['audioChunks'] = [];
            const recordingStartTime = new Date().getTime();
            let timeIntervalId:any = null;

            const stopStreamAndRecorder = () => {
                if(voiceRecorder.stopped) return void 0;
                mediaRecorder.stop();
                stream.getTracks().forEach(track => track.stop());
                voiceRecorder.stopped = true;
            }

            let voiceRecorder:VoiceRecorder = {
                stopped: false,
                stop: stopStreamAndRecorder,
                audioChunks,
                waveformSamples,
                duration: 0
            };

            mediaRecorder.onstop = () => {
                clearInterval(timeIntervalId);
                setIsRecording(false);
            }

            mediaRecorder.onstart = () => {
                setIsRecording(true);
            }

            voiceRecorderList.current.push(voiceRecorder);
            if(autoStopped) {
                stopStreamAndRecorder();
            }

            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
        
            mediaRecorder.ondataavailable = async (event) => {
                audioChunks.push(event.data);

                const currentChunkGuessedDuration = (new Date().getTime() - recordingStartTime) / 1000;

                try{
                    const audioContext = new AudioContext();
                    const arrayBuffer = await event.data.arrayBuffer();
                    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                    voiceRecorder.duration += audioBuffer.duration;
                }catch {
                    voiceRecorder.duration += currentChunkGuessedDuration;
                }

                const totalDuration = voiceRecorderList.current.reduce((total, voiceRecorder) => {
                    return total + voiceRecorder.duration;
                }, 0);

                setAudio(currentState => ({...currentState, duration: totalDuration}));
            };

            mediaRecorder.start();
            timeIntervalId = setInterval(() => {
                const duration = voiceRecorderList.current.reduce((total, voiceRecorder) => {
                    return total + voiceRecorder.duration;
                }, 0) + ((new Date().getTime() - recordingStartTime) / 1000);

                onRecordingDurationUpdate({duration});
            }, 1000);
        
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
        
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);

            const previousWaveformSamples = voiceRecorderList.current.map(voiceRecorder => voiceRecorder.waveformSamples).flat(1);

            function downsampleWaveform() {
                analyser.getByteTimeDomainData(dataArray);

                const data = [];

                for(let i = 0; i < dataArray.length; i++) {
                    data.push((dataArray[i] - 128) / 128);
                }

                downsampledWaveform.push(...adjustWaveData(data, 1));
        
                if(downsampledWaveform.length >= 8) {
                    waveformSamples.push(...adjustWaveData(downsampledWaveform, 1));
                    downsampledWaveform.splice(0, downsampledWaveform.length);
                    viewRecordingCanvas.current && drawWaveform({waveData: previousWaveformSamples.concat(waveformSamples), canvas: viewRecordingCanvas.current, waveStyle: recordingWaveStyle, progressPercentage: NaN, fillType: 'crop'});
                }
        
                if(!voiceRecorder.stopped) {
                    requestAnimationFrame(downsampleWaveform);
                }
            }
        
            if(!autoStopped && isRecordingRef.current) {
                downsampleWaveform();
            }
        }


        if(!autoStopped && isRecordingRef.current) {
            startRecording();
        }

        startVoiceRecording.current = startRecording;

        return () => {
            autoStopped = true;
            voiceRecorderList.current.forEach((voiceRecorder) => {
                voiceRecorder.stop();
            });
        }
    }, []);

    const toggleRecording = () => {
        if(voiceRecorderList.current.every(voiceRecorder => voiceRecorder.stopped)) {
            startVoiceRecording.current();
        }else {
            voiceRecorderList.current.forEach((voiceRecorder) => {
                voiceRecorder.stop();
            });
        }
    }
    
    const onAudioToggle = useCallback(({paused}:{paused:boolean}) => {
        setAudio(currentState => ({...currentState, paused}));
    }, []);

    const onAudioTimeupdate = useCallback(({currentTimePercentage, duration, ended}:{currentTimePercentage: number; duration: number, ended:boolean, paused:boolean}) => {
        setAudio(currentState => ({...currentState, currentTimePercentage: (ended ? 0 : currentTimePercentage), duration}));
    }, []);

    const getAudioUrl = useCallback(async () => {
        if(generatedAudioUrl.current !== null) return generatedAudioUrl.current;
        finalAudioBlob.current = await mergeAudioBlobs(voiceRecorderList.current.map(voiceRecorder => voiceRecorder.audioChunks).flat(1));
        const audioUrl = URL.createObjectURL(finalAudioBlob.current);
        return generatedAudioUrl.current = [{type: 'audio/wav', src: audioUrl}];
    }, []);

    const onRequestAudioInit = useCallback(async () => {
        const audioUrl = await getAudioUrl();
        setAudio((currentState) => ({...currentState, audioInitiated: true, audioUrl}));
    }, []);

    const toggleRecordedAudio = async () => {
        const audioUrl = await getAudioUrl();
        setAudio(currentState => ({...currentState, audioInitiated: true, audioUrl, paused: !currentState.paused}))
    }

    return (
        <div className="flex justify-center h-full items-center flex-1 gap-2 fixed left-0 top-0 right-0 bottom-0 bg-[#00000080] z-20 backdrop-blur-[1.5px]">
            <button onClick={deleteRecordingHandler} className="absolute right-3 top-3 p-1 bg-[#dddddd] shadow-md transition-colors hover:bg-white hover:underline rounded-full px-4 cursor-pointer text-[14px]">Close</button>
            <div className="bg-white flex justify-center items-center h-[110px] p-[24px] rounded-[8px] max-sm:p-[12px] shadow-lg">
                <button onClick={deleteRecordingHandler} className="size-9 rounded-full text-red-500 hover:text-red-700 cursor-pointer hover:bg-[#f5f5f5] flex items-center justify-center">
                    <Icon icon={'mdi:delete'} className="!size-6"/>
                </button>
                <div
                    className={clsx(
                        "flex gap-1 items-center pl-1 pr-1/2 h-[32px]",
                        {
                            "hidden": !isRecording
                        }
                    )}
                >
                    <div className="flex text-body-medium items-center !leading-[1] w-10 h-7 rounded-[34px] justify-center px-[2px] text-[14px] font-medium">{!!isRecording && formatDuration(recordingTime, true)}</div>
                    <div className="flex-1 h-[28px]">
                        <canvas ref={viewRecordingCanvas} width={window.innerWidth <= 380 ? 176 : 216} height={28}></canvas>
                    </div>
                </div>
                {
                    !isRecording && (
                        <div className="bg-light-chat_bubble-received-bg_n300 h-[32px] rounded-[35px] px-1/2 pr-1 flex items-center gap-1">
                            <button onClick={toggleRecordedAudio} className="w-8 h-7 cursor-pointer rounded-full text-[#6852D6] hover:text-[#4935ab]  hover:bg-[#f5f5f5] flex items-center justify-center">
                                <Icon icon={audio.paused ? 'mdi:play' : 'mdi:pause'} className="!size-6"/>
                            </button>
                            <AudioWaveProgressBar
                                onAudioToggle={onAudioToggle}
                                onAudioTimeupdate={onAudioTimeupdate}
                                onRequestAudioInit={onRequestAudioInit}
                                waveData={voiceRecorderList.current.map(vr => vr.waveformSamples).flat(1)}
                                audioUrl={audio.audioInitiated ? audio.audioUrl : []}
                                currentTimePercentage={audio.currentTimePercentage}
                                duration={audio.duration}
                                width={window.innerWidth <= 380 ? 140 : 180}
                                height={28}
                                paused={audio.paused}
                                waveStyle={{
                                    baseColor: "#bdbdbd",
                                    progressColor: '#6852d6',
                                    seekDotColor: '#6852d6',
                                    barWidth: 2,
                                    horizontalPadding: 6,
                                    verticalPadding: 2,
                                    minimumGap: 2,
                                    seekDotSize: 12
                                }}
                            />
                            <div className="flex text-[14px] font-medium items-center !leading-[1] w-10 h-7 rounded-[34px] justify-center px-[2px]">{formatDuration(audio.currentTimePercentage === 0 ? audio.duration : audio.currentTimePercentage * audio.duration, true)}</div>
                        </div>
                    )
                }
                
                <button onClick={toggleRecording} className="size-9 rounded-full text-[#5B5B5B] hover:text-[#434343] cursor-pointer hover:bg-[#f5f5f5] flex items-center justify-center">
                    <Icon icon={isRecording ? 'mdi:pause-circle-outline' : 'ic:outline-keyboard-voice'} className="!size-6"/>
                </button>
            </div>
        </div>
    )
}