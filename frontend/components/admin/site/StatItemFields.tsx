"use client";

import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWatch } from "react-hook-form";

import { SelectField, TextField, type AnyControl } from "@/components/admin/form";
import { FieldShell } from "@/components/admin/form/FieldShell";
import type { SiteInput } from "@/components/admin/site/site-schema";
import { dashboardQueryOptions } from "@/components/admin/shell/dashboard-query";
import { Input } from "@/components/admin/ui/input";

const AUTO_OPTIONS = [{ value: "projects", label: "Published project count" }];

type StatItemFieldsProps = {
  control: AnyControl<SiteInput>;
  /** RepeaterField item path, e.g. "stats.2". */
  name: `stats.${number}`;
};

/**
 * One stat counter. With "Auto value" = projects the API fills the value with the published
 * project count, so the value input is replaced by that (read-only) number.
 */
export function StatItemFields({ control, name }: StatItemFieldsProps) {
  const stat = useWatch({ control, name });
  const auto = stat?.auto === "projects";
  const dashboard = useQuery({ ...dashboardQueryOptions, enabled: auto });
  const computedId = useId();

  const count = dashboard.data?.counts.published_projects;
  const computed = count !== undefined ? String(count) : dashboard.isError ? "unknown" : "loading…";
  const shown = auto ? (count !== undefined ? String(count) : "N") : stat?.value || "—";
  const preview = `${stat?.prefix ?? ""}${shown}${stat?.suffix ?? ""}`;

  return (
    <>
      <TextField
        control={control}
        name={`${name}.label`}
        label="Label"
        required
        maxLength={60}
        placeholder="GPA"
        className="sm:col-span-2"
      />
      <SelectField
        control={control}
        name={`${name}.auto`}
        label="Auto value"
        options={AUTO_OPTIONS}
        nullable
        noneLabel="Off: use the value below"
        className="sm:col-span-2"
      />
      <TextField control={control} name={`${name}.prefix`} label="Prefix" nullable maxLength={20} />
      {auto ? (
        <FieldShell
          id={computedId}
          label="Value"
          description="Computed: the number of published projects."
          className="sm:col-span-2"
        >
          <Input
            id={computedId}
            value={computed}
            disabled
            readOnly
            aria-describedby={`${computedId}-description`}
            className="tabular-nums"
          />
        </FieldShell>
      ) : (
        <TextField
          control={control}
          name={`${name}.value`}
          label="Value"
          nullable
          maxLength={30}
          description="Display text, e.g. 3.91 or 1,000. Numbers animate as a counter."
          className="sm:col-span-2"
        />
      )}
      <TextField control={control} name={`${name}.suffix`} label="Suffix" nullable maxLength={20} />
      <p className="text-muted-foreground text-xs sm:col-span-4">
        Preview: <span className="text-foreground font-mono font-medium">{preview}</span>{" "}
        {stat?.label || "Label"}
      </p>
    </>
  );
}
