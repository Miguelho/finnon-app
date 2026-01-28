import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { Plus, X, ImageSquare } from "phosphor-react-native";
import * as ImagePicker from "expo-image-picker";
import { themeTokens, type TransactionDraft, type PhotoAttachment } from "@poleursus/shared";
import { useCopy, t } from "../../../lib/i18n";

const tokens = themeTokens.light;
const colors = tokens.colors;

interface Step3NotesProps {
  draft: TransactionDraft;
  errors: Record<string, string>;
  onFieldChange: <K extends keyof TransactionDraft>(
    field: K,
    value: TransactionDraft[K]
  ) => void;
}

export function Step3Notes({ draft, errors, onFieldChange }: Step3NotesProps) {
  const { dictionary } = useCopy();
  const [isPickingImage, setIsPickingImage] = useState(false);

  const handleAddPhotos = async () => {
    if (isPickingImage) return;

    try {
      setIsPickingImage(true);

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          t(dictionary, "common.error"),
          t(dictionary, "addTransaction.photosPermissionDenied")
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets.length > 0) {
        const newPhotos: PhotoAttachment[] = result.assets.map((asset) => ({
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          uri: asset.uri,
          status: "pending" as const,
          mimeType: asset.mimeType ?? "image/jpeg",
          sizeBytes: asset.fileSize ?? 0,
        }));

        onFieldChange("photos", [...draft.photos, ...newPhotos]);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert(
        t(dictionary, "common.error"),
        t(dictionary, "addTransaction.photosError")
      );
    } finally {
      setIsPickingImage(false);
    }
  };

  const handleRemovePhoto = (photoId: string) => {
    onFieldChange(
      "photos",
      draft.photos.filter((p) => p.id !== photoId)
    );
  };

  return (
    <View style={styles.container}>
      {/* Notes field */}
      <View style={styles.field}>
        <Text style={styles.label}>
          {t(dictionary, "addTransaction.notesLabel")}
        </Text>
        <TextInput
          style={styles.textArea}
          value={draft.notes}
          onChangeText={(value) => onFieldChange("notes", value)}
          placeholder={t(dictionary, "addTransaction.notesPlaceholder")}
          placeholderTextColor={colors.text.muted}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      {/* Photos field */}
      <View style={styles.field}>
        <Text style={styles.label}>
          {t(dictionary, "addTransaction.photosLabel")}
        </Text>

        {/* Photo grid */}
        <View style={styles.photoGrid}>
          {/* Existing photos */}
          {draft.photos.map((photo) => (
            <View key={photo.id} style={styles.photoItem}>
              <Image source={{ uri: photo.uri }} style={styles.photoImage} />

              {/* Status indicator */}
              {photo.status === "uploading" && (
                <View style={styles.photoOverlay}>
                  <Text style={styles.uploadingText}>...</Text>
                </View>
              )}

              {photo.status === "failed" && (
                <View style={[styles.photoOverlay, styles.photoOverlayError]}>
                  <X size={24} color={colors.bg.primary} weight="bold" />
                </View>
              )}

              {/* Remove button */}
              <TouchableOpacity
                onPress={() => handleRemovePhoto(photo.id)}
                style={styles.removeButton}
                accessibilityLabel={t(dictionary, "addTransaction.photoRemove")}
              >
                <X size={14} color={colors.bg.primary} weight="bold" />
              </TouchableOpacity>
            </View>
          ))}

          {/* Add photo button */}
          <TouchableOpacity
            onPress={handleAddPhotos}
            style={styles.addPhotoButton}
            disabled={isPickingImage}
            accessibilityLabel={t(dictionary, "addTransaction.photosAdd")}
          >
            <Plus size={24} color={colors.text.muted} />
            <Text style={styles.addPhotoText}>
              {t(dictionary, "addTransaction.photosAdd")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Empty state */}
        {draft.photos.length === 0 && (
          <View style={styles.emptyState}>
            <ImageSquare size={16} color={colors.text.muted} />
            <Text style={styles.emptyText}>
              {t(dictionary, "addTransaction.photosEmpty")}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 32,
  },
  field: {
    gap: tokens.spacing.lg,
  },
  label: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
    marginBottom: tokens.spacing.sm,
  },
  textArea: {
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: tokens.radii.lg,
    paddingVertical: tokens.spacing.xl,
    paddingHorizontal: tokens.spacing.xl,
    fontSize: tokens.typography.size.md,
    backgroundColor: colors.bg.surface,
    color: colors.text.primary,
    minHeight: 160,
    textAlignVertical: "top",
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.lg,
  },
  photoItem: {
    width: 100,
    height: 100,
    borderRadius: tokens.radii.lg,
    overflow: "hidden",
    position: "relative",
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoOverlayError: {
    backgroundColor: colors.state.negative + "80",
  },
  uploadingText: {
    color: colors.bg.primary,
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.bold,
  },
  removeButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  addPhotoButton: {
    width: 100,
    height: 100,
    borderRadius: tokens.radii.lg,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.state.neutral,
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacing.sm,
  },
  addPhotoText: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.muted,
  },
  emptyState: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.md,
    paddingVertical: tokens.spacing.xl,
  },
  emptyText: {
    fontSize: tokens.typography.size.md,
    color: colors.text.muted,
  },
});
