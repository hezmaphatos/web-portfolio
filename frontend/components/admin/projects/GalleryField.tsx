"use client";

import { useId, useState } from "react";
import {
  get,
  useFieldArray,
  useFormState,
  type FieldError as RhfFieldError,
} from "react-hook-form";
import { ChevronLeftIcon, ChevronRightIcon, ImagePlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/admin/ui/button";
import { FieldError, SelectField, TextField, type AnyControl } from "@/components/admin/form";
import { MediaPicker } from "@/components/admin/media";
import { MediaThumb } from "@/components/admin/table";
import { SortableItem, SortableList } from "@/components/admin/projects/SortableList";
import {
  DEVICE_LABEL,
  guessDevice,
  type ProjectFormValues,
} from "@/components/admin/projects/project-form";
import { DEVICES } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_GALLERY = 100;

const DEVICE_OPTIONS = DEVICES.map((device) => ({ value: device, label: DEVICE_LABEL[device] }));

function messageOf(node: unknown): string | undefined {
  if (!node || typeof node !== "object") return undefined;
  const error = node as RhfFieldError & { root?: RhfFieldError };
  return error.message || error.root?.message || undefined;
}

/**
 * `gallery[]` editor (spec §7 Media tab): add images from the Media Library (multi-select or
 * upload), drag or move them into display order, and set each one's device frame and caption.
 */
export function GalleryField({ control }: { control: AnyControl<ProjectFormValues> }) {
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "gallery",
    keyName: "key",
  });
  const { errors } = useFormState({ control, name: "gallery" });
  const [open, setOpen] = useState(false);
  const baseId = useId();
  const rootError = messageOf(get(errors, "gallery"));
  const full = fields.length >= MAX_GALLERY;

  const labelOf = (index: number) => `image ${index + 1}`;

  function moveTo(from: number, to: number, focusId?: string) {
    if (to < 0 || to >= fields.length || from === to) return;
    move(from, to);
    if (focusId) requestAnimationFrame(() => document.getElementById(focusId)?.focus());
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-3" data-field="gallery">
      <legend className="sr-only">Gallery</legend>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {fields.length === 0
            ? "No screenshots yet."
            : `${fields.length} ${fields.length === 1 ? "image" : "images"} · order = order on the site.`}
        </p>
        <Button
          id={`${baseId}-add`}
          type="button"
          variant="outline"
          size="sm"
          disabled={full}
          onClick={() => setOpen(true)}
        >
          <ImagePlusIcon aria-hidden />
          Add images
        </Button>
      </div>

      {fields.length === 0 ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-muted-foreground hover:bg-muted/40 focus-visible:ring-ring/50 rounded-lg border border-dashed px-4 py-10 text-center text-sm outline-none focus-visible:ring-2"
        >
          Add screenshots from the Media Library or upload new ones. Each image gets a device frame
          (desktop, tablet or mobile) and an optional caption.
        </button>
      ) : (
        <SortableList
          ids={fields.map((field) => field.key)}
          onMove={(from, to) => moveTo(from, to)}
          labelOf={(key) => labelOf(fields.findIndex((field) => field.key === key))}
          layout="grid"
        >
          <ol
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
            aria-label="Gallery images"
          >
            {fields.map((field, index) => {
              const itemError =
                messageOf(get(errors, `gallery.${index}.media_id`)) ??
                messageOf(get(errors, `gallery.${index}`));
              const prevId = `${baseId}-prev-${field.key}`;
              const nextId = `${baseId}-next-${field.key}`;
              return (
                <SortableItem
                  key={field.key}
                  id={field.key}
                  label={labelOf(index)}
                  className={cn(
                    "bg-card flex flex-col overflow-hidden rounded-lg border",
                    itemError && "border-destructive",
                  )}
                >
                  {({ handle }) => (
                    <div className="flex flex-col" data-field={`gallery.${index}`}>
                      <div className="flex items-center gap-1 border-b px-1.5 py-1">
                        {handle}
                        <span className="text-muted-foreground text-xs font-medium tabular-nums">
                          #{index + 1}
                        </span>
                        <div className="ml-auto flex items-center gap-0.5">
                          <Button
                            id={prevId}
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={index === 0}
                            onClick={() => moveTo(index, index - 1, prevId)}
                            aria-label={`Move ${labelOf(index)} earlier`}
                          >
                            <ChevronLeftIcon aria-hidden />
                          </Button>
                          <Button
                            id={nextId}
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={index === fields.length - 1}
                            onClick={() => moveTo(index, index + 1, nextId)}
                            aria-label={`Move ${labelOf(index)} later`}
                          >
                            <ChevronRightIcon aria-hidden />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              remove(index);
                              requestAnimationFrame(() =>
                                document.getElementById(`${baseId}-add`)?.focus(),
                              );
                            }}
                            aria-label={`Remove ${labelOf(index)}`}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2Icon aria-hidden />
                          </Button>
                        </div>
                      </div>
                      <div className="bg-muted/50 flex aspect-video items-center justify-center">
                        {field.media ? (
                          // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail from storage
                          <img
                            src={field.media.thumb_url ?? field.media.url}
                            alt={field.media.alt ?? `Gallery image ${index + 1}`}
                            loading="lazy"
                            className="size-full object-contain"
                          />
                        ) : (
                          <MediaThumb media={null} size="lg" label={`Image #${field.media_id}`} />
                        )}
                      </div>
                      <div className="flex flex-col gap-3 p-3">
                        <SelectField
                          control={control}
                          name={`gallery.${index}.device`}
                          label="Device frame"
                          options={DEVICE_OPTIONS}
                        />
                        <TextField
                          control={control}
                          name={`gallery.${index}.caption`}
                          label="Caption"
                          nullable
                          maxLength={255}
                          placeholder="Optional"
                        />
                        <FieldError message={itemError} />
                      </div>
                    </div>
                  )}
                </SortableItem>
              );
            })}
          </ol>
        </SortableList>
      )}
      <FieldError message={rootError} />

      <MediaPicker
        open={open}
        onOpenChange={setOpen}
        multiple
        accept="image"
        maxSelect={MAX_GALLERY - fields.length}
        title="Add gallery images"
        description="Select images in the order you want them; upload new ones here too."
        excludeIds={fields.map((field) => field.media_id)}
        onSelect={(list) =>
          append(
            list.map((media) => ({
              media_id: media.id,
              device: guessDevice(media),
              caption: null,
              media,
            })),
          )
        }
      />
    </fieldset>
  );
}
