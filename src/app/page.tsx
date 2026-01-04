"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Mic, Play, Loader2, Pause } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/hooks/use-toast";
import { useToast } from "@/hooks/use-toast";

const AUDIO_SYNC_INTERVAL = 1000; // Sync every 1 second
const BROADCAST_CHANNEL = 'audio-stream-channel';

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isNoiseReducing, setIsNoiseReducing] = useState(false);
  const [volume, setVolume] = useState(50);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
    const { toast } = useToast();


  useEffect(() => {
    broadcastChannelRef.current = new BroadcastChannel(BROADCAST_CHANNEL);

    broadcastChannelRef.current.onmessage = (event) => {
      if (event.data.type === 'audioSync' && audioRef.current) {
        audioRef.current.currentTime = event.data.currentTime;
        setIsPlaying(event.data.isPlaying); // Sync play state
        if (event.data.isPlaying && audioRef.current.paused) {
          audioRef.current.play().catch(e => console.error("Playback failed:", e));
        } else if (!event.data.isPlaying && !audioRef.current.paused) {
          audioRef.current.pause();
        }
      }
    };

    return () => {
      broadcastChannelRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (audioUrl) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onloadedmetadata = () => {
        setDuration(audioRef.current!.duration);
      };
      audioRef.current.ontimeupdate = () => {
        setCurrentTime(audioRef.current!.currentTime);
      };
      audioRef.current.onended = () => setIsPlaying(false);
    }

    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  useEffect(() => {
    const syncAudio = () => {
      if (isPlaying && audioRef.current) {
        broadcastChannelRef.current?.postMessage({
          type: 'audioSync',
          currentTime: audioRef.current.currentTime,
          isPlaying: isPlaying // Send play state
        });
      }
    };

    const intervalId = setInterval(syncAudio, AUDIO_SYNC_INTERVAL);

    return () => clearInterval(intervalId);
  }, [isPlaying]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      mediaRecorder.current.ondataavailable = (event) => {
        audioChunks.current.push(event.data);
      };
      mediaRecorder.current.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        toast({
              title: "Recording stopped",
              description: "Recording saved successfully",
            });
      };
      audioChunks.current = [];
      mediaRecorder.current.start();
      setIsRecording(true);
      toast({
              title: "Recording started",
              description: "Keep talking",
            });
    } catch (error) {
      console.error("Error starting recording:", error);
      toast({
              variant: "destructive",
              title: "Error",
              description: "Failed to start recording. Check permissions.",
            });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state === "recording") {
      mediaRecorder.current.stop();
      setIsRecording(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      broadcastChannelRef.current?.postMessage({
            type: 'audioSync',
            currentTime: audioRef.current.currentTime,
            isPlaying: false
          });
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(error => {
          console.error("Playback failed:", error);
             toast({
              variant: "destructive",
              title: "Playback failed",
              description: error.message,
            });
        });
         broadcastChannelRef.current?.postMessage({
            type: 'audioSync',
            currentTime: audioRef.current.currentTime,
            isPlaying: true
          });
    }
  };

  const reduceNoise = async () => {
    if (!audioUrl) {
      toast({
              title: "No audio",
              description: "No audio recorded to reduce noise.",
            });
      return;
    }

    setIsNoiseReducing(true);
    try {
      // TODO: Implement the noise reduction logic using your GenAI flow
      //  const response = await reduceNoiseFlow({ audioUrl });
      //  setAudioUrl(response.reducedNoiseAudioUrl);
      await new Promise((resolve) => setTimeout(resolve, 2000));
       toast({
              title: "Noise reduction",
              description: "Noise Reduction Complete!",
            });
    } catch (error) {
      console.error("Error reducing noise:", error);
       toast({
              variant: "destructive",
              title: "Error reducing noise",
              description: error.message,
            });
    } finally {
      setIsNoiseReducing(false);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0] / 100;
    setVolume(value[0]);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };
    const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background text-foreground">
      <h1 className="text-3xl font-bold mb-6">EchoLink</h1>

      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col space-y-4">
          <div className="flex justify-center">
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isPlaying || isNoiseReducing}
              className="rounded-full p-6 shadow-md transition-colors duration-300"
              variant={isRecording ? "destructive" : "primary"}
            >
              {isRecording ? <Mic className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              {isRecording ? "Stop Recording" : "Push to Talk"}
            </Button>
          </div>

          {audioUrl && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{formatTime(currentTime)}</span>
                <span className="text-sm text-muted-foreground">{formatTime(duration)}</span>
              </div>
              <Slider
                defaultValue={[0]}
                max={duration}
                step={0.1}
                value={[currentTime]}
                onValueChange={(value) => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = value[0];
                    setCurrentTime(value[0]);
                  }
                }}
                aria-label="Audio timeline"
              />
              <div className="flex items-center space-x-4">
                <Button
                  onClick={togglePlay}
                  disabled={isRecording || isNoiseReducing}
                  variant="secondary"
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {isPlaying ? "Pause" : "Play"}
                </Button>

                <Button
                  onClick={reduceNoise}
                  disabled={isRecording || isPlaying || isNoiseReducing}
                  variant="accent"
                >
                  {isNoiseReducing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reduce Noise"}
                </Button>
              </div>

              <div className="flex items-center space-x-2">
                <label htmlFor="volume" className="text-sm font-medium">Volume</label>
                <Slider
                  id="volume"
                  defaultValue={[volume]}
                  max={100}
                  step={1}
                  onValueChange={handleVolumeChange}
                  aria-label="Volume"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
