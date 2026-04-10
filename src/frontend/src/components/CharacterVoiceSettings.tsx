/**
 * CharacterVoiceSettings — individual character voice card for Voice Studio.
 * Shows voice selector (filtered by effective language), pitch/rate sliders,
 * and language override with clear/reset button for one character.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import type { VoiceAssignment } from "@/hooks/useTableRead";
import { ttsRegistry } from "@/lib/tts";
import { CHARACTER_COLORS, getInitials } from "@/types";
import type { CharacterColorIndex } from "@/types";
import { Copy, Volume2, X } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

interface VoiceOption {
  id: string;
  name: string;
  lang: string;
}

interface CharacterVoiceSettingsProps {
  characterName: string;
  dialogueCount: number;
  colorIndex: CharacterColorIndex;
  assignment: VoiceAssignment;
  voices: VoiceOption[];
  availableLanguages: string[];
  globalLanguage: string;
  /** Which TTS provider is active: "kokoro" | "web-speech" | etc. */
  activeProvider: string;
  copiedSettings: VoiceAssignment | null;
  onUpdate: (updates: Partial<VoiceAssignment>) => void;
  onCopy: (settings: VoiceAssignment) => void;
  onPaste: () => void;
  /** Web Speech voices for test fallback */
  webSpeechVoices: SpeechSynthesisVoice[];
}

export function CharacterVoiceSettings({
  characterName,
  dialogueCount,
  colorIndex,
  assignment,
  voices,
  availableLanguages,
  globalLanguage,
  activeProvider,
  copiedSettings,
  onUpdate,
  onCopy,
  onPaste,
  webSpeechVoices,
}: CharacterVoiceSettingsProps) {
  const color = CHARACTER_COLORS[colorIndex];

  // Effective language for this character: override if set, else global
  const effectiveLang = assignment.language || globalLanguage;
  const hasLanguageOverride =
    !!assignment.language && assignment.language !== globalLanguage;

  /**
   * Filter the voice list to only voices matching the effective language.
   * Kokoro: af_/am_ → en-US, bf_/bm_ → en-GB
   * Web Speech: filter by voice.lang prefix
   * If no voices match, fall back to showing all voices with a note.
   */
  const filteredVoices = useMemo(() => {
    if (voices.length === 0) return voices;

    const filtered = voices.filter((v) => {
      if (activeProvider === "kokoro") {
        // Map Kokoro voice prefixes to language
        const prefix = v.id.slice(0, 3); // "af_", "am_", "bf_", "bm_"
        const voiceLang =
          prefix === "af_" || prefix === "am_"
            ? "en-US"
            : prefix === "bf_" || prefix === "bm_"
              ? "en-GB"
              : v.lang;
        return voiceLang === effectiveLang;
      }
      // Web Speech: match by lang prefix (e.g. "en" matches "en-US", "en-GB")
      const langPrefix = effectiveLang.split("-")[0];
      return (
        v.lang === effectiveLang ||
        v.lang.startsWith(`${langPrefix}-`) ||
        v.lang === langPrefix
      );
    });

    return filtered.length > 0 ? filtered : voices;
  }, [voices, effectiveLang, activeProvider]);

  const voicesFiltered = filteredVoices.length < voices.length;

  const testVoice = async () => {
    const provider = ttsRegistry.getActiveProvider();
    if (!provider?.isReady()) {
      // Fallback to Web Speech for preview
      const utt = new SpeechSynthesisUtterance(`Hello, I am ${characterName}.`);
      utt.pitch = assignment.pitch;
      utt.rate = assignment.rate;
      if (assignment.language) utt.lang = assignment.language;
      if (assignment.voiceName) {
        const v = webSpeechVoices.find(
          (vv) => vv.name === assignment.voiceName,
        );
        if (v) utt.voice = v;
      }
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utt);
      return;
    }

    provider.cancel();
    try {
      await provider.synthesize(`Hello, I am ${characterName}.`, {
        voiceId: assignment.voiceName,
        pitch: assignment.pitch,
        rate: assignment.rate,
        language: assignment.language,
      });
    } catch {
      toast.error("Voice test failed");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <span
              className={`character-badge w-10 h-10 text-sm ${color.bg} ${color.text} border ${color.border}`}
            >
              {getInitials(characterName)}
            </span>
            <div>
              <CardTitle className="font-display text-lg">
                {characterName}
              </CardTitle>
              <CardDescription>
                {characterName === "Narrator"
                  ? "Narration voice"
                  : `${dialogueCount} dialogue lines`}
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onCopy(assignment);
                toast.success(`Copied ${characterName}'s settings`);
              }}
              disabled={!assignment.voiceName}
              aria-label="Copy voice settings"
              data-ocid="copy-settings"
            >
              <Copy className="w-3.5 h-3.5 mr-1" />
              Copy
            </Button>
            {copiedSettings && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onPaste();
                  toast.success(`Pasted to ${characterName}`);
                }}
                data-ocid="paste-settings"
              >
                Paste
              </Button>
            )}
            <Button
              size="sm"
              onClick={testVoice}
              className="gap-1.5"
              data-ocid="test-voice"
            >
              <Volume2 className="w-3.5 h-3.5" />
              Test
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Voice select — filtered by effective language */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor={`voice-${characterName}`}>Voice</Label>
            {voicesFiltered && (
              <span className="text-xs text-muted-foreground">
                Filtered to {effectiveLang}
              </span>
            )}
          </div>
          <Select
            value={
              assignment.voiceName ?? filteredVoices[0]?.id ?? "__no_voice__"
            }
            onValueChange={(v) => onUpdate({ voiceName: v })}
          >
            <SelectTrigger
              id={`voice-${characterName}`}
              data-ocid="voice-select"
            >
              <SelectValue placeholder="Select a voice" />
            </SelectTrigger>
            <SelectContent>
              {filteredVoices.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                  <span className="text-muted-foreground text-xs ml-1">
                    ({v.lang})
                  </span>
                </SelectItem>
              ))}
              {/* If we fell back to all voices, add a note */}
              {!voicesFiltered && voices.length > 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground border-t border-border">
                  No voices match {effectiveLang} — showing all
                </div>
              )}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Pitch slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Pitch</Label>
            <Badge variant="secondary" className="font-mono text-xs">
              {assignment.pitch.toFixed(1)}
            </Badge>
          </div>
          <Slider
            min={0.5}
            max={2.0}
            step={0.05}
            value={[assignment.pitch]}
            onValueChange={([v]) => onUpdate({ pitch: v })}
            className="cursor-pointer"
            data-ocid="pitch-slider"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Low</span>
            <span>Normal</span>
            <span>High</span>
          </div>
        </div>

        {/* Rate slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Speed</Label>
            <Badge variant="secondary" className="font-mono text-xs">
              {assignment.rate.toFixed(1)}×
            </Badge>
          </div>
          <Slider
            min={0.5}
            max={2.0}
            step={0.05}
            value={[assignment.rate]}
            onValueChange={([v]) => onUpdate({ rate: v })}
            className="cursor-pointer"
            data-ocid="rate-slider"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Slow</span>
            <span>Normal</span>
            <span>Fast</span>
          </div>
        </div>

        <Separator />

        {/* Language override with clear button */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor={`lang-${characterName}`}>Language Override</Label>
            {hasLanguageOverride && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onUpdate({ language: undefined })}
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                aria-label="Clear language override"
                data-ocid="clear-language-override"
              >
                <X className="w-3 h-3" />
                Reset to global
              </Button>
            )}
          </div>
          <Select
            value={assignment.language ?? "__global__"}
            onValueChange={(v) =>
              onUpdate({ language: v === "__global__" ? undefined : v })
            }
          >
            <SelectTrigger
              id={`lang-${characterName}`}
              data-ocid="char-language-select"
              className={hasLanguageOverride ? "border-primary/50" : ""}
            >
              <SelectValue placeholder={`Global (${globalLanguage})`} />
            </SelectTrigger>
            <SelectContent>
              {/* Show current global as the default option */}
              <SelectItem value="__global__" className="text-muted-foreground">
                Global ({globalLanguage})
              </SelectItem>
              {availableLanguages
                .filter((lang) => lang !== globalLanguage)
                .map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {lang}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {hasLanguageOverride && (
            <p className="text-xs text-primary/80">
              Override: {assignment.language} (global: {globalLanguage})
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
