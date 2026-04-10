/**
 * ScreenplayPlayer — two-tab layout (Play + Voice Studio).
 * Play tab: formatted screenplay with per-character color-coding,
 *   current block highlighted, auto-scroll follows playback in real time
 *   and when switching to the Play tab.
 * Voice Studio tab: CharacterVoiceSettings via VoiceStudio.
 * Sticky controls: play/pause, skip-back (2-sec rule), skip-forward,
 *   interactive progress bar (click to seek), scene-jump dropdown.
 */

import { VoiceStudio } from "@/components/VoiceStudio";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGetScreenplay, useGetVoiceSettings } from "@/hooks/useQueries";
import { useTableRead } from "@/hooks/useTableRead";
import type { VoiceAssignment } from "@/hooks/useTableRead";
import { parseScreenplay } from "@/lib/fountainParser";
import type { ParsedElement } from "@/types";
import { CHARACTER_COLORS, getCharacterColor, getInitials } from "@/types";
import {
  ArrowLeft,
  Loader2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface ScreenplayPlayerProps {
  screenplayId: string;
  onBack: () => void;
}

export function ScreenplayPlayer({
  screenplayId,
  onBack,
}: ScreenplayPlayerProps) {
  const { data: screenplay, isLoading } = useGetScreenplay(screenplayId);
  const { data: savedSettings = [] } = useGetVoiceSettings(screenplayId);
  const [parsedElements, setParsedElements] = useState<ParsedElement[]>([]);
  const [voiceAssignments, setVoiceAssignments] = useState<
    Record<string, VoiceAssignment>
  >({});
  const [activeTab, setActiveTab] = useState<string>("play");

  // Ref to the inner scrollable div of the screenplay area
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  // Map from element index → DOM element
  const elementRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const {
    isPlaying,
    currentIndex,
    progress,
    play,
    pause,
    skipForward,
    skipBack,
    seekTo,
    isInitializing,
    characters,
    availableVoices,
    defaultVoiceAssignments,
  } = useTableRead(
    parsedElements,
    screenplay?.language ?? "en-US",
    voiceAssignments,
  );

  const handleVoiceAssignmentsChange = useCallback(
    (assignments: Record<string, VoiceAssignment>) => {
      setVoiceAssignments(assignments);
    },
    [],
  );

  // Parse screenplay content
  useEffect(() => {
    if (screenplay?.content) {
      setParsedElements(parseScreenplay(screenplay.content));
    }
  }, [screenplay]);

  /**
   * Scroll the screenplay viewport so the active element is centred.
   * We operate on the inner scrollable div (scrollViewportRef) directly
   * rather than calling el.scrollIntoView() which would scroll the page body.
   */
  const scrollToBlock = useCallback((index: number) => {
    const viewport = scrollViewportRef.current;
    const el = elementRefs.current.get(index);
    if (!viewport || !el) return;

    const viewportRect = viewport.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    const offset =
      el.offsetTop -
      viewport.scrollTop -
      viewportRect.height / 2 +
      elRect.height / 2;

    viewport.scrollBy({ top: offset, behavior: "smooth" });
  }, []);

  // Auto-scroll when the current block changes (during playback)
  useEffect(() => {
    if (currentIndex < 0) return;
    scrollToBlock(currentIndex);
  }, [currentIndex, scrollToBlock]);

  // When switching back to Play tab, scroll to the current (or last paused) block
  useEffect(() => {
    if (activeTab !== "play") return;
    if (currentIndex >= 0) {
      // Small delay to let the tab content mount
      const t = setTimeout(() => scrollToBlock(currentIndex), 80);
      return () => clearTimeout(t);
    }
  }, [activeTab, currentIndex, scrollToBlock]);

  // Build character → color-index map
  const characterColorMap = new Map<string, number>();
  characters.forEach((char, i) => {
    characterColorMap.set(char.name, i);
  });

  // Build scene headings list for the jump dropdown
  const sceneHeadings = useMemo(
    () =>
      parsedElements
        .map((el, index) => ({ el, index }))
        .filter(({ el }) => el.type === "scene_heading"),
    [parsedElements],
  );

  // Current scene: find the last scene_heading at or before currentIndex
  const currentSceneIndex = useMemo(() => {
    if (currentIndex < 0 || sceneHeadings.length === 0) return "";
    let last = sceneHeadings[0].index;
    for (const { index } of sceneHeadings) {
      if (index <= currentIndex) last = index;
      else break;
    }
    return String(last);
  }, [currentIndex, sceneHeadings]);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (parsedElements.length === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width),
      );
      const targetIndex = Math.round(ratio * (parsedElements.length - 1));
      seekTo(targetIndex);
    },
    [parsedElements.length, seekTo],
  );

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Skeleton className="h-8 w-24 mb-6" />
        <Skeleton className="h-12 w-72 mb-4" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!screenplay) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Screenplay not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pt-6 pb-44 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          data-ocid="back-button"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <h2 className="text-xl font-bold font-display truncate min-w-0">
          {screenplay.title}
        </h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4" data-ocid="tab-list">
          <TabsTrigger value="play" data-ocid="tab-play">
            Play
          </TabsTrigger>
          <TabsTrigger value="voices" data-ocid="tab-voices">
            Voice Studio
          </TabsTrigger>
        </TabsList>

        {/* ── Play Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="play">
          <Card>
            <CardContent className="p-0">
              {/* 
                We use a plain div with overflow-y: auto instead of ScrollArea
                so we can hold a direct ref to the scrollable container and
                use scrollBy() for precise, smooth centring.
              */}
              <div
                ref={scrollViewportRef}
                className="overflow-y-auto h-[calc(100vh-360px)] min-h-[400px] scrollbar-thin"
              >
                <div className="screenplay-content p-6 space-y-1">
                  {parsedElements.map((element, index) => {
                    const isActive = index === currentIndex;
                    const colorIdx = element.character
                      ? getCharacterColor(
                          characterColorMap.get(element.character) ?? 0,
                        )
                      : null;
                    const color =
                      colorIdx !== null ? CHARACTER_COLORS[colorIdx] : null;

                    return (
                      <div
                        key={`${element.type}-${index}`}
                        ref={(el) => {
                          if (el) elementRefs.current.set(index, el);
                          else elementRefs.current.delete(index);
                        }}
                        role="presentation"
                        onClick={() => seekTo(index)}
                        onKeyUp={(e) => {
                          if (e.key === "Enter") seekTo(index);
                        }}
                        className={`relative transition-all duration-200 rounded-sm px-3 py-1 cursor-pointer ${
                          isActive
                            ? "script-block-active"
                            : "opacity-70 hover:opacity-90 hover:bg-muted/20"
                        }`}
                        data-ocid={isActive ? "active-block" : undefined}
                      >
                        {element.type === "scene_heading" && (
                          <p className="font-bold uppercase text-xs tracking-widest text-primary py-2">
                            {element.text}
                          </p>
                        )}
                        {element.type === "action" && (
                          <p className="text-foreground/90">{element.text}</p>
                        )}
                        {element.type === "character" && color && (
                          <div className="flex items-center gap-2 mt-3 ml-[25%]">
                            <span
                              className={`character-badge w-7 h-7 text-[10px] ${color.bg} ${color.text}`}
                              aria-hidden
                            >
                              {getInitials(element.text)}
                            </span>
                            <p
                              className={`font-bold uppercase text-sm tracking-wide ${color.text}`}
                            >
                              {element.text}
                            </p>
                          </div>
                        )}
                        {element.type === "dialogue" && (
                          <p
                            className={`ml-[25%] mr-[15%] ${
                              isActive && color
                                ? color.text
                                : "text-foreground/80"
                            }`}
                          >
                            {element.text}
                          </p>
                        )}
                        {element.type === "parenthetical" && (
                          <p className="ml-[30%] mr-[20%] text-muted-foreground italic text-sm">
                            {element.text}
                          </p>
                        )}
                        {element.type === "transition" && (
                          <p className="text-right text-xs uppercase tracking-widest text-muted-foreground py-2">
                            {element.text}
                          </p>
                        )}
                      </div>
                    );
                  })}
                  {parsedElements.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                      <p className="text-muted-foreground">
                        No readable content found in this screenplay.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Voice Studio Tab ─────────────────────────────────────────── */}
        <TabsContent value="voices">
          <VoiceStudio
            screenplayId={screenplayId}
            characters={characters}
            availableVoices={availableVoices}
            voiceAssignments={voiceAssignments}
            defaultVoiceAssignments={defaultVoiceAssignments}
            onVoiceAssignmentsChange={handleVoiceAssignmentsChange}
            savedSettings={savedSettings}
            scriptLanguage={screenplay.language}
          />
        </TabsContent>
      </Tabs>

      {/* ── Sticky Playback Controls ─────────────────────────────────── */}
      <div
        className="sticky-controls fixed bottom-0 left-0 right-0"
        data-ocid="playback-controls"
      >
        <div className="container mx-auto max-w-5xl px-4 py-3">
          {/* Interactive progress bar */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-muted-foreground tabular-nums w-16 text-right flex-shrink-0">
              {currentIndex >= 0
                ? `${currentIndex + 1} / ${parsedElements.length}`
                : `0 / ${parsedElements.length}`}
            </span>
            <div
              className="progress-track flex-1 cursor-pointer group relative"
              onClick={handleProgressClick}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") skipForward();
                if (e.key === "ArrowLeft") skipBack();
              }}
              role="slider"
              tabIndex={0}
              aria-label="Playback position"
              aria-valuemin={0}
              aria-valuemax={parsedElements.length}
              aria-valuenow={Math.max(0, currentIndex)}
              data-ocid="progress-bar"
            >
              <div
                className="progress-fill group-hover:opacity-90 transition-opacity"
                style={{ width: `${progress}%` }}
              />
              {/* Thumb indicator */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity shadow-md pointer-events-none"
                style={{ left: `calc(${progress}% - 6px)` }}
              />
            </div>
          </div>

          {/* Scene-jump dropdown + skip/play controls */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Scene jump */}
            <div className="flex-1 min-w-0 max-w-xs">
              {sceneHeadings.length > 0 ? (
                <Select
                  value={currentSceneIndex}
                  onValueChange={(v) => seekTo(Number(v))}
                >
                  <SelectTrigger
                    className="h-8 text-xs w-full"
                    data-ocid="scene-jump-select"
                  >
                    <SelectValue placeholder="Jump to scene…" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {sceneHeadings.map(({ el, index }) => (
                      <SelectItem
                        key={index}
                        value={String(index)}
                        className="text-xs"
                      >
                        <span className="truncate block max-w-[260px]">
                          {el.text.length > 50
                            ? `${el.text.slice(0, 50)}…`
                            : el.text}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-xs text-muted-foreground">No scenes</span>
              )}
            </div>

            {/* Playback buttons */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <Button
                variant="outline"
                size="icon"
                onClick={skipBack}
                disabled={currentIndex < 0 || isInitializing}
                aria-label="Skip back"
                data-ocid="skip-back"
              >
                <SkipBack className="w-4 h-4" />
              </Button>

              <Button
                size="lg"
                onClick={isPlaying ? pause : play}
                disabled={isInitializing || parsedElements.length === 0}
                className="w-32 gap-2"
                data-ocid="play-pause"
              >
                {isInitializing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isPlaying ? (
                  <>
                    <Pause className="w-5 h-5" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Play
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={skipForward}
                disabled={
                  currentIndex >= parsedElements.length - 1 || isInitializing
                }
                aria-label="Skip forward"
                data-ocid="skip-forward"
              >
                <SkipForward className="w-4 h-4" />
              </Button>
            </div>

            {/* Spacer to balance the layout */}
            <div className="flex-1 max-w-xs hidden sm:block" />
          </div>
        </div>
      </div>
    </div>
  );
}
