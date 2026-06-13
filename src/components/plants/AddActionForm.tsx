import { useEffect, useState } from "react";
import { CircleAlert, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ALLOWED_PHOTO_MIME_TYPES, MAX_PHOTO_FILE_SIZE } from "@/lib/photo-validation";
import { cn } from "@/lib/utils";

interface ActionTypeOption {
  id: string;
  name: string;
  icon_emoji: string;
}

interface Props {
  plantId: string;
}

const CUSTOM_ACTION_VALUE = "__custom__";
const MAX_PHOTOS = 5;
const MAX_NOTES_LENGTH = 1000;

export default function AddActionForm({ plantId }: Props) {
  const [actionTypes, setActionTypes] = useState<ActionTypeOption[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [customName, setCustomName] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/action-types");
      if (!response.ok) return;

      const data = (await response.json()) as { action_types: ActionTypeOption[] };
      setActionTypes(data.action_types);
      if (data.action_types[0]) {
        setSelectedTypeId(data.action_types[0].id);
      }
    })();
  }, []);

  function validate(): boolean {
    const next: Record<string, string> = {};

    if (selectedTypeId === CUSTOM_ACTION_VALUE) {
      const trimmed = customName.trim();
      if (!trimmed) {
        next.customName = "Custom action name is required";
      } else if (trimmed.length > 300) {
        next.customName = "Name must be at most 300 characters";
      }
    } else if (!selectedTypeId) {
      next.actionType = "Select an action type";
    }

    if (!date) {
      next.date = "Date is required";
    }

    const trimmedNotes = notes.trim();
    if (trimmedNotes.length > MAX_NOTES_LENGTH) {
      next.notes = `Notes must be at most ${String(MAX_NOTES_LENGTH)} characters`;
    }

    if (photoFiles.length > MAX_PHOTOS) {
      next.photos = `Maximum ${String(MAX_PHOTOS)} photos per action`;
    }

    for (const file of photoFiles) {
      if (!ALLOWED_PHOTO_MIME_TYPES.includes(file.type as (typeof ALLOWED_PHOTO_MIME_TYPES)[number])) {
        next.photos = "Photos must be JPEG, PNG, or WebP";
        break;
      }
      if (file.size > MAX_PHOTO_FILE_SIZE) {
        next.photos = "Each photo must be 10 MB or smaller";
        break;
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      const trimmedNotes = notes.trim();
      const notesPayload = trimmedNotes.length > 0 ? { additional_data: trimmedNotes } : {};

      const actionBody =
        selectedTypeId === CUSTOM_ACTION_VALUE
          ? {
              plant_id: plantId,
              custom_action_name: customName.trim(),
              date: new Date(date).toISOString(),
              ...notesPayload,
            }
          : { plant_id: plantId, action_type_id: selectedTypeId, date: new Date(date).toISOString(), ...notesPayload };

      const actionResponse = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(actionBody),
      });

      const actionData = (await actionResponse.json()) as {
        action?: { id: string };
        error?: { message: string };
      };

      if (!actionResponse.ok || !actionData.action?.id) {
        setErrors({ submit: actionData.error?.message ?? "Failed to create action" });
        return;
      }

      const actionId = actionData.action.id;

      for (const file of photoFiles) {
        const formData = new FormData();
        formData.append("action_id", actionId);
        formData.append("file", file);

        const uploadResponse = await fetch("/api/photos/upload", { method: "POST", body: formData });
        if (!uploadResponse.ok) {
          const uploadData = (await uploadResponse.json()) as { error?: { message: string } };
          setErrors({ submit: uploadData.error?.message ?? "Failed to upload photo" });
          return;
        }
      }

      window.location.reload();
    } catch {
      setErrors({ submit: "Network error. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="border-border space-y-4 rounded-xl border p-4" onSubmit={handleSubmit} noValidate>
      <h2 className="text-foreground text-lg font-semibold">Add action</h2>

      <div className="space-y-2">
        <Label htmlFor="action-type">Action</Label>
        <select
          id="action-type"
          value={selectedTypeId}
          onChange={(event) => {
            setSelectedTypeId(event.target.value);
            if (errors.actionType) setErrors((prev) => ({ ...prev, actionType: "" }));
          }}
          className={cn(
            "border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs",
            errors.actionType && "border-destructive",
          )}
        >
          {actionTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.icon_emoji} {type.name.replace(/_/g, " ")}
            </option>
          ))}
          <option value={CUSTOM_ACTION_VALUE}>Custom action...</option>
        </select>
        {errors.actionType ? <p className="text-destructive text-xs">{errors.actionType}</p> : null}
      </div>

      {selectedTypeId === CUSTOM_ACTION_VALUE ? (
        <div className="space-y-2">
          <Label htmlFor="custom-action-name">Custom action name</Label>
          <Input
            id="custom-action-name"
            value={customName}
            onChange={(event) => {
              setCustomName(event.target.value);
              if (errors.customName) setErrors((prev) => ({ ...prev, customName: "" }));
            }}
            placeholder="e.g., planted in ground"
            maxLength={300}
            aria-invalid={Boolean(errors.customName)}
          />
          {errors.customName ? <p className="text-destructive text-xs">{errors.customName}</p> : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="action-date">Date</Label>
        <Input
          id="action-date"
          type="date"
          value={date}
          onChange={(event) => {
            setDate(event.target.value);
            if (errors.date) setErrors((prev) => ({ ...prev, date: "" }));
          }}
          aria-invalid={Boolean(errors.date)}
        />
        {errors.date ? <p className="text-destructive text-xs">{errors.date}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="action-notes">Notes (optional)</Label>
        <textarea
          id="action-notes"
          value={notes}
          onChange={(event) => {
            setNotes(event.target.value);
            if (errors.notes) setErrors((prev) => ({ ...prev, notes: "" }));
          }}
          placeholder="e.g., Used organic fertilizer, 5L water"
          maxLength={MAX_NOTES_LENGTH}
          rows={3}
          aria-invalid={Boolean(errors.notes)}
          className={cn(
            "border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]",
            errors.notes && "border-destructive",
          )}
        />
        {errors.notes ? <p className="text-destructive text-xs">{errors.notes}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="action-photos">Photos (optional, max {MAX_PHOTOS})</Label>
        <Input
          id="action-photos"
          type="file"
          accept={ALLOWED_PHOTO_MIME_TYPES.join(",")}
          multiple
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []).slice(0, MAX_PHOTOS);
            setPhotoFiles(files);
            if (errors.photos) setErrors((prev) => ({ ...prev, photos: "" }));
          }}
        />
        {errors.photos ? <p className="text-destructive text-xs">{errors.photos}</p> : null}
        {photoFiles.length > 0 ? (
          <p className="text-muted-foreground text-xs">
            {photoFiles.length} photo{photoFiles.length === 1 ? "" : "s"} selected
          </p>
        ) : null}
      </div>

      {errors.submit ? (
        <p className="text-destructive flex items-center gap-1 text-sm">
          <CircleAlert className="size-4 shrink-0" />
          {errors.submit}
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? (
          <span className="flex items-center gap-2">
            <span className="border-primary-foreground/30 border-t-primary-foreground size-4 animate-spin rounded-full border-2" />
            Saving action...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Plus className="size-4" />
            Add action
          </span>
        )}
      </Button>
    </form>
  );
}
