/**
 * VoiceStudio — dedicated tab for configuring voices per character.
 * Narrator listed first, then characters sorted by dialogue count.
 * Randomize preserves the top-level script language.
 * Uses CharacterVoiceSettings for per-character editing.
 */

import type { CharacterVoiceSetting } from "@/backend";
import { CharacterVoiceSettings } from "@/components/CharacterVoiceSettings";
import { TTSProviderSelector } from "@/components/TTSProviderSelector";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSaveVoiceSettings } from "@/hooks/useQueries";
import { useTTSProvider } from "@/hooks/useTTSProvider";
import type {
  CharacterDialogueCount,
  VoiceAssignment,
} from "@/hooks/useTableRead";
import { CHARACTER_COLORS, getCharacterColor, getInitials } from "@/types";
import {
  AlertCircle,
  CheckCircle2,
  Globe,
  Save,
  Shuffle,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface VoiceStudioProps {
  screenplayId: string;
  characters: CharacterDialogueCount[];
  availableVoices: SpeechSynthesisVoice[];
  voiceAssignments: Record<string, VoiceAssignment>;
  defaultVoiceAssignments: Record<string, VoiceAssignment>;
  onVoiceAssignmentsChange: (
    assignments: Record<string, VoiceAssignment>,
  ) => void;
  savedSettings: CharacterVoiceSetting[];
  scriptLanguage: string;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function distinctPitches(count: number): number[] {
  return Array.from({ length: count }, (_, i) => {
    const raw = 0.6 + (0.9 / Math.max(count - 1, 1)) * i;
    return Math.round(raw * 10) / 10;
  });
}

function distinctRates(count: number): number[] {
  const slow = [0.75, 0.8, 0.85, 0.9, 0.95];
  const fast = [1.1, 1.15, 1.2, 1.25, 1.3, 1.4];
  return Array.from({ length: count }, (_, i) =>
    i % 2 === 0
      ? slow[Math.floor(i / 2) % slow.length]
      : fast[Math.floor(i / 2) % fast.length],
  );
}

export function VoiceStudio({
  screenplayId,
  characters,
  availableVoices,
  voiceAssignments,
  defaultVoiceAssignments,
  onVoiceAssignmentsChange,
  savedSettings,
  scriptLanguage,
}: VoiceStudioProps) {
  const saveVoiceSettings = useSaveVoiceSettings();
  const hasLoadedSaved = useRef(false);
  const [copiedSettings, setCopiedSettings] = useState<VoiceAssignment | null>(
    null,
  );
  const [globalLanguage, setGlobalLanguage] = useState(scriptLanguage);
  const [selectedChar, setSelectedChar] = useState<string | null>(null);
  const { activeProvider } = useTTSProvider();

  // Load saved voice settings from backend once
  useEffect(() => {
    if (savedSettings.length > 0 && !hasLoadedSaved.current) {
      hasLoadedSaved.current = true;
      const loaded: Record<string, VoiceAssignment> = {};
      for (const s of savedSettings) {
        loaded[s.character] = {
          voiceName: s.voiceUri || undefined,
          pitch: s.pitch,
          rate: s.rate,
          language: globalLanguage,
        };
      }
      onVoiceAssignmentsChange(loaded);
    }
  }, [savedSettings, globalLanguage, onVoiceAssignmentsChange]);

  // Select first character on mount
  useEffect(() => {
    if (characters.length > 0 && !selectedChar) {
      setSelectedChar(characters[0].name);
    }
  }, [characters, selectedChar]);

  // Build display voices from active provider, fall back to Web Speech
  const providerVoices = activeProvider?.voices ?? [];
  const displayVoices =
    providerVoices.length > 0
      ? providerVoices.map((v) => ({ name: v.name, id: v.id, lang: v.lang }))
      : availableVoices.map((v) => ({
          name: v.name,
          id: v.name,
          lang: v.lang,
        }));

  const availableLanguages = Array.from(
    new Set(displayVoices.map((v) => v.lang)),
  ).sort();

  const getAssignment = (name: string): VoiceAssignment =>
    voiceAssignments[name] ??
    defaultVoiceAssignments[name] ?? {
      pitch: 1.0,
      rate: 1.0,
      language: globalLanguage,
    };

  const updateAssignment = (
    character: string,
    updates: Partial<VoiceAssignment>,
  ) => {
    const current = getAssignment(character);
    onVoiceAssignmentsChange({
      ...voiceAssignments,
      [character]: { ...current, ...updates },
    });
  };

  const persistSettings = async (
    assignments: Record<string, VoiceAssignment>,
  ) => {
    const settings: CharacterVoiceSetting[] = Object.entries(assignments).map(
      ([char, a]) => ({
        character: char,
        voiceUri: a.voiceName ?? "",
        pitch: a.pitch,
        rate: a.rate,
        language: a.language ?? globalLanguage,
      }),
    );
    try {
      await saveVoiceSettings.mutateAsync({ screenplayId, settings });
      toast.success("Voice settings saved");
    } catch {
      toast.error("Failed to save voice settings");
    }
  };

  const randomizeAll = () => {
    // Only pick voices matching the top-level language — do NOT randomize language
    const langVoices = displayVoices.filter((v) => v.lang === globalLanguage);
    const voicePool = langVoices.length > 0 ? langVoices : displayVoices;
    const shuffled = shuffleArray(voicePool);
    const pitches = distinctPitches(characters.length);
    const rates = distinctRates(characters.length);
    const assignments: Record<string, VoiceAssignment> = {};
    characters.forEach((char, i) => {
      assignments[char.name] = {
        voiceName: shuffled[i % shuffled.length].id,
        pitch: pitches[i],
        rate: rates[i],
        language: globalLanguage, // always use top-level language, never randomize
      };
    });
    onVoiceAssignmentsChange(assignments);
    persistSettings(assignments);
    toast.success("All voices randomized!");
  };

  const activeChar = selectedChar ?? characters[0]?.name ?? null;
  const activeCharData = characters.find((c) => c.name === activeChar);
  const activeColorIdx = activeChar
    ? getCharacterColor(characters.findIndex((c) => c.name === activeChar))
    : 0;

  return (
    <div className="space-y-4" data-ocid="voice-studio">
      {/* TTS Engine + Global Controls */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="font-display text-xl flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Voice Studio
              </CardTitle>
              <CardDescription>
                Choose your voice engine and assign distinct voices to each
                character
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <Label htmlFor="global-lang" className="sr-only">
                  Script Language
                </Label>
                <Select
                  value={globalLanguage}
                  onValueChange={(v) => setGlobalLanguage(v)}
                >
                  <SelectTrigger
                    id="global-lang"
                    className="w-36 h-8 text-xs"
                    data-ocid="language-select"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableLanguages.map((lang) => (
                      <SelectItem key={lang} value={lang} className="text-xs">
                        {lang}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={randomizeAll}
                className="gap-1.5"
                data-ocid="randomize-all"
              >
                <Shuffle className="w-3.5 h-3.5" />
                Randomize
              </Button>
              <Button
                size="sm"
                onClick={() => persistSettings(voiceAssignments)}
                disabled={saveVoiceSettings.isPending}
                className="gap-1.5"
                data-ocid="save-voice-settings"
              >
                <Save className="w-3.5 h-3.5" />
                Save
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <TTSProviderSelector />
        </CardContent>
      </Card>

      <div className="grid grid-cols-[240px_1fr] gap-4">
        {/* Character list */}
        <Card>
          <CardContent className="p-2">
            <ScrollArea className="h-[520px] scrollbar-thin">
              <div className="space-y-1 p-1">
                {characters.map((char, i) => {
                  const colorIdx = getCharacterColor(i);
                  const color = CHARACTER_COLORS[colorIdx];
                  const a = getAssignment(char.name);
                  const hasVoice = !!a.voiceName;
                  const isSelected = char.name === activeChar;

                  return (
                    <button
                      type="button"
                      key={char.name}
                      onClick={() => setSelectedChar(char.name)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-smooth ${
                        isSelected
                          ? `${color.bg} ${color.border} border`
                          : "hover:bg-muted/50"
                      }`}
                      data-ocid={`char-${char.name.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <span
                        className={`character-badge w-8 h-8 text-[11px] flex-shrink-0 ${color.bg} ${color.text} border ${color.border}`}
                      >
                        {getInitials(char.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm font-medium truncate ${isSelected ? color.text : ""}`}
                        >
                          {char.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {char.name === "Narrator"
                            ? "narration"
                            : `${char.count} lines`}
                        </p>
                      </div>
                      {hasVoice ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Character editor panel */}
        {activeChar && (
          <CharacterVoiceSettings
            characterName={activeChar}
            dialogueCount={activeCharData?.count ?? 0}
            colorIndex={activeColorIdx}
            assignment={getAssignment(activeChar)}
            voices={displayVoices}
            availableLanguages={availableLanguages}
            globalLanguage={globalLanguage}
            activeProvider={activeProvider?.id ?? "web-speech"}
            copiedSettings={copiedSettings}
            onUpdate={(updates) => updateAssignment(activeChar, updates)}
            onCopy={(settings) => setCopiedSettings(settings)}
            onPaste={() => {
              if (copiedSettings) updateAssignment(activeChar, copiedSettings);
            }}
            webSpeechVoices={availableVoices}
          />
        )}
      </div>
    </div>
  );
}
