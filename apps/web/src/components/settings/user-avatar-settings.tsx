"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserAvatar } from "@/components/user-avatar";
import {
  ALLOWED_AVATAR_BG_TOKENS,
  normalizeAvatarFallbackText,
  resolveAvatarColor,
  resolveAvatarFallback,
  themeTokens,
  type AvatarColorToken,
} from "@poleursus/shared";

type UserAvatarSettingsProps = {
  userId: string;
  email: string;
};

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const tokens = themeTokens.light;

export function UserAvatarSettings({ userId, email }: UserAvatarSettingsProps) {
  const t = useTranslations("settings.userDetails");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  const [fallbackBgToken, setFallbackBgToken] =
    useState<AvatarColorToken | null>(null);
  const [profileEmail, setProfileEmail] = useState<string>(email);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [draftBgToken, setDraftBgToken] =
    useState<AvatarColorToken | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      const supabase = createClient();
      const { data, error: profileError } = await supabase
        .from("profiles")
        .select(
          "avatar_path, email, avatar_fallback_text, avatar_fallback_bg_token"
        )
        .eq("user_id", userId)
        .maybeSingle();

      if (cancelled) return;

      if (profileError) {
        setError(t("avatar.uploadError"));
        setIsLoading(false);
        return;
      }

      setAvatarPath(data?.avatar_path ?? null);
      setFallbackText(data?.avatar_fallback_text ?? null);
      const bgToken = ALLOWED_AVATAR_BG_TOKENS.includes(
        data?.avatar_fallback_bg_token as AvatarColorToken
      )
        ? (data?.avatar_fallback_bg_token as AvatarColorToken)
        : null;
      setFallbackBgToken(bgToken);
      if (data?.email) {
        setProfileEmail(data.email);
      }
      setIsLoading(false);
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [t, userId]);

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setError(t("avatar.typeError"));
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      setError(t("avatar.sizeError"));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/avatar.${extension}`;
    const supabase = createClient();

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { contentType: file.type, upsert: true });

    if (uploadError) {
      setError(t("avatar.uploadError"));
      setIsSubmitting(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_path: path })
      .eq("user_id", userId);

    if (updateError) {
      await supabase.storage.from("avatars").remove([path]);
      setError(t("avatar.uploadError"));
      setIsSubmitting(false);
      return;
    }

    setAvatarPath(path);
    setAvatarVersion(Date.now());
    setIsSubmitting(false);
  };

  const handleRemoveAvatar = async () => {
    if (!avatarPath) return;

    const previousPath = avatarPath;
    setAvatarPath(null);
    setIsSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: removeError } = await supabase.storage
      .from("avatars")
      .remove([previousPath]);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_path: null })
      .eq("user_id", userId);

    if (updateError) {
      setAvatarPath(previousPath);
      setError(t("avatar.removeError"));
    } else if (removeError) {
      setError(t("avatar.removeError"));
    }

    setAvatarVersion(Date.now());
    setIsSubmitting(false);
  };

  const handleOpenEditor = () => {
    setError(null);
    setDraftText(normalizeAvatarFallbackText(fallbackText) ?? "");
    setDraftBgToken(fallbackBgToken ?? null);
    setIsEditorOpen(true);
  };

  const handleDraftTextChange = (value: string) => {
    const normalized = normalizeAvatarFallbackText(value);
    setDraftText(normalized ?? "");
  };

  const handleRandomizeBg = () => {
    const options = ALLOWED_AVATAR_BG_TOKENS.filter(
      (token) => token !== draftBgToken
    );
    if (options.length === 0) return;
    const next = options[Math.floor(Math.random() * options.length)];
    setDraftBgToken(next);
  };

  const handleSaveFallback = async () => {
    setIsSubmitting(true);
    setError(null);

    const previousText = fallbackText;
    const previousToken = fallbackBgToken;
    const nextText = normalizeAvatarFallbackText(draftText);
    const nextToken = ALLOWED_AVATAR_BG_TOKENS.includes(
      draftBgToken as AvatarColorToken
    )
      ? draftBgToken
      : null;

    setFallbackText(nextText);
    setFallbackBgToken(nextToken);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        avatar_fallback_text: nextText,
        avatar_fallback_bg_token: nextToken,
      })
      .eq("user_id", userId);

    if (updateError) {
      setFallbackText(previousText);
      setFallbackBgToken(previousToken);
      setError(t("avatar.fallbackError"));
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    setIsEditorOpen(false);
  };

  const fallbackPreview = resolveAvatarFallback(
    {
      avatar_fallback_text: draftText || null,
      avatar_fallback_bg_token: draftBgToken ?? null,
    },
    profileEmail,
    userId
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("avatar.title")}</CardTitle>
        <CardDescription>{t("avatar.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <UserAvatar
              email={profileEmail}
              userId={userId}
              avatarPath={avatarPath}
              fallbackText={fallbackText}
              fallbackBgToken={fallbackBgToken}
              size={64}
              label={profileEmail}
              cacheKey={avatarVersion}
              className="shrink-0"
            />
            <div className="text-sm text-muted-foreground">
              {isLoading ? t("loading") : profileEmail}
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleOpenEditor}
            disabled={isSubmitting || isLoading}
          >
            {t("avatar.edit")}
          </Button>
        </div>
        {error ? (
          <p className="mt-3 text-sm text-destructive">{error}</p>
        ) : null}
      </CardContent>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("avatar.editorTitle")}</DialogTitle>
            <DialogDescription>{t("avatar.editorDescription")}</DialogDescription>
          </DialogHeader>

          {avatarPath ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={handleFileSelect}
                disabled={isSubmitting}
              >
                {t("avatar.changePhoto")}
              </Button>
              <Button
                variant="ghost"
                onClick={handleRemoveAvatar}
                disabled={isSubmitting}
              >
                {t("avatar.removePhoto")}
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={handleFileSelect}
              disabled={isSubmitting}
            >
              {t("avatar.changePhoto")}
            </Button>
          )}

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <UserAvatar
                email={profileEmail}
                userId={userId}
                avatarPath={null}
                fallbackText={fallbackPreview.text}
                fallbackBgToken={fallbackPreview.bgToken}
                size={64}
                label={profileEmail}
              />
              <div className="text-sm text-muted-foreground">
                {t("avatar.fallbackHint")}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  {t("avatar.letterLabel")}
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDraftText("")}
                  disabled={isSubmitting}
                >
                  {t("avatar.letterReset")}
                </Button>
              </div>
              <Input
                value={draftText}
                onChange={(event) => handleDraftTextChange(event.target.value)}
                maxLength={1}
                placeholder={fallbackPreview.text}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  {t("avatar.backgroundLabel")}
                </label>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDraftBgToken(null)}
                    disabled={isSubmitting}
                  >
                    {t("avatar.backgroundReset")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRandomizeBg}
                    disabled={isSubmitting}
                  >
                    {t("avatar.backgroundRandom")}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-6 gap-2">
                {ALLOWED_AVATAR_BG_TOKENS.map((token) => {
                  const color = resolveAvatarColor(tokens, token);
                  const isSelected = draftBgToken === token;
                  return (
                    <button
                      key={token}
                      type="button"
                      onClick={() =>
                        setDraftBgToken(isSelected ? null : token)
                      }
                      className={`h-9 w-9 rounded-full border ${
                        isSelected ? "border-foreground" : "border-border"
                      }`}
                      style={{ backgroundColor: color }}
                      aria-label={token}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditorOpen(false)}
              disabled={isSubmitting}
            >
              {t("avatar.cancel")}
            </Button>
            <Button onClick={handleSaveFallback} disabled={isSubmitting}>
              {t("avatar.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
