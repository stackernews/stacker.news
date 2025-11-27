let currentPlayingAudio = null
export const registerAudioElement = (audioElement) => {
  if (!audioElement) return () => {}
  const handlePlay = () => {
    if (currentPlayingAudio && currentPlayingAudio !== audioElement) {
      currentPlayingAudio.pause()
    }
    currentPlayingAudio = audioElement
  }
  audioElement.addEventListener('play', handlePlay)
  return () => {
    audioElement.removeEventListener('play', handlePlay)
    if (currentPlayingAudio === audioElement) {
      currentPlayingAudio = null
    }
  }
}
