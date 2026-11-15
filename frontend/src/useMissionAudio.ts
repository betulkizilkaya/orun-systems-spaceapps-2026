import { useCallback, useEffect, useRef, useState } from 'react'

const SOUND_PREFERENCE_KEY = 'orun-mission-sound'

export function useMissionAudio() {
    const [soundEnabled, setSoundEnabled] = useState(() => {
        try {
            return window.localStorage.getItem(SOUND_PREFERENCE_KEY) !== 'off'
        } catch {
            return true
        }
    })

    const soundEnabledRef = useRef(soundEnabled)
    const foregroundAudio = useRef<HTMLAudioElement | null>(null)
    const initializationPlayed = useRef(false)

    useEffect(() => {
        return () => {
            foregroundAudio.current?.pause()
            foregroundAudio.current = null
        }
    }, [])

    function toggleSound() {
        const enabled = !soundEnabledRef.current
        soundEnabledRef.current = enabled
        setSoundEnabled(enabled)

        if (!enabled) {
            foregroundAudio.current?.pause()
            foregroundAudio.current = null
        }

        try {
            window.localStorage.setItem(SOUND_PREFERENCE_KEY, enabled ? 'on' : 'off')
        } catch {
            // Tercih mevcut oturumda uygulanmaya devam eder.
        }
    }

    const playForeground = useCallback((file: string, volume: number, interrupt = false) => {
        if (!soundEnabledRef.current) return

        const current = foregroundAudio.current
        const src = `${import.meta.env.BASE_URL}audio/${file}`

        if (current && !current.paused && !current.ended) {
            if (!interrupt || current.getAttribute('src') === src) return
            current.pause()
        }

        const audio = new Audio(src)
        foregroundAudio.current = audio
        audio.volume = volume

        void audio.play().catch(() => {
            // Ses oynatılamazsa arayüz çalışmaya devam eder.
        })
    }, [])

    function playUiClick() {
        playForeground('ui-click.mp3', 0.25)
    }

    function playInitialization() {
        if (initializationPlayed.current) return
        initializationPlayed.current = true
        playForeground('system-initialization.mp3', 0.4)
    }

    function playCameraTransition() {
        playForeground('astronaut-camera-transition.mp3', 0.35, true)
    }

    const playRouteCalculated = useCallback(() => {
        playForeground('route-calculated-voice.mp3', 0.65, true)
    }, [playForeground])

    function playDestinationReached() {
        playForeground('destination-reached-voice.mp3', 0.65, true)
    }

    return {
        soundEnabled,
        toggleSound,
        playUiClick,
        playInitialization,
        playCameraTransition,
        playRouteCalculated,
        playDestinationReached,
    }
}