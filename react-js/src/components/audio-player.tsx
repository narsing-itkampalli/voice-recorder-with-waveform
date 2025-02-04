import { useCallback, useState } from "react";
import { Icon } from "@iconify/react";
import AudioWaveProgressBar from "./audio-wave-progress-bar";
import { formatDuration, pendingAudioDuration } from "../helpers/format-duration";

interface AudioPlayerData {
    sources: { type: string; src: string }[];
    duration: number; // In seconds
    waveData: number[];
}

export default function AudioPlayer({data}:{data: AudioPlayerData}) {
    const [audio, setAudio] = useState({
        paused: true,
        currentTimePercentage: 0,
        duration: data.duration,
        audioInitiated: false
    });
    
    const onAudioToggle = useCallback(({paused}:{paused:boolean}) => {
        setAudio(currentState => ({...currentState, paused}));
    }, []);

    const onAudioTimeupdate = useCallback(({currentTimePercentage, duration, ended}:{currentTimePercentage: number; duration: number, ended:boolean, paused:boolean}) => {
        setAudio(currentState => ({...currentState, currentTimePercentage: (ended ? 0 : currentTimePercentage), duration}));
    }, []);
    
    const onRequestAudioInit = useCallback(() => {
        setAudio(currentState => ({...currentState, audioInitiated: true}));
    }, []);

    const toggleAudio = () => {
        setAudio(currentState => ({...currentState, audioInitiated: true, paused: !currentState.paused}))
    }

    return (
        <div className="rounded-xl p-1 min-w-[110px] min-h-9 text-[#141414] bg-[#e8e8e8] w-max">
            <div className="flex items-center gap-2 p-1">
                <div
                    className={"flex-none size-12 rounded-[8px] flex flex-col items-center justify-center gap-1 relative bg-[#dcdcdc]"}
                >
                    <span className="text-[20px] -mt-3">
                        <Icon icon="material-symbols:keyboard-voice" />
                    </span>
                    <span className="text-caption2-regular text-[11px] absolute bottom-[4px]">{(audio.currentTimePercentage === 0 || audio.paused) ? formatDuration(audio.duration, true) : pendingAudioDuration(audio.duration, audio.currentTimePercentage * audio.duration)}</span>
                </div>
                <div className="flex gap-[6px]">
                    <div className="flex flex-col justify-center relative flex-1">
                        <AudioWaveProgressBar
                            onAudioToggle={onAudioToggle}
                            onAudioTimeupdate={onAudioTimeupdate}
                            onRequestAudioInit={onRequestAudioInit}
                            waveData={data.waveData}
                            audioUrl={audio.audioInitiated ? data.sources : []}
                            currentTimePercentage={audio.currentTimePercentage}
                            duration={audio.duration}
                            width={180}
                            height={28}
                            paused={audio.paused}
                            waveStyle={{
                                baseColor: '#ccc4f1',
                                progressColor: '#6852d6',
                                seekDotColor: '#6852d6',
                                barWidth: 2,
                                horizontalPadding: 6,
                                verticalPadding: 2,
                                minimumGap: 2,
                                seekDotSize: 12
                            }}
                        />
                    </div>
                    <div className="flex items-center flex-none">
                        <button
                            onClick={toggleAudio}
                            className={"text-[24px] size-8 flex items-center justify-center rounded-full bg-[#6852d6] text-white cursor-pointer"}
                        >
                            <Icon icon={!audio.paused ? 'material-symbols:pause' : 'mdi:play'}/>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}