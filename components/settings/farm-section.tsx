"use client";

// Farm Settings content: the farm profile form (name required, location and
// description optional). Saving a name is what clears the onboarding banner.

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useFarm, useUpdateFarm } from "@/hooks/use-farm";
import { ApiError } from "@/lib/api-client";
import type { Farm } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

export function FarmSection() {
  const farm = useFarm(true);

  if (farm.isLoading) {
    return (
      <div className="rounded-2xl border bg-card p-4 space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-11 rounded-xl" />)}
      </div>
    );
  }
  if (farm.isError) {
    return <p className="text-sm text-destructive">Failed to load farm profile.</p>;
  }
  if (!farm.data) return null;

  // Keyed on the farm id so the form initialises from the loaded values without
  // syncing via an effect.
  return <FarmProfileForm key={farm.data.id} farm={farm.data} />;
}

function FarmProfileForm({ farm }: { farm: Farm }) {
  const update = useUpdateFarm();
  const [name, setName] = useState(farm.name ?? "");
  const [location, setLocation] = useState(farm.location ?? "");
  const [description, setDescription] = useState(farm.description ?? "");

  const needsSetup = !farm.name?.trim();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Farm name is required.");
      return;
    }
    try {
      await update.mutateAsync({
        name: name.trim(),
        location: location.trim() || null,
        description: description.trim() || null,
      });
      toast.success("Farm profile saved successfully.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save farm profile");
    }
  }

  return (
    <form onSubmit={save} className="rounded-2xl border bg-card p-4 space-y-4">
      {needsSetup && (
        <p className="rounded-xl bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
          Finish setting up your farm to unlock the full dashboard.
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="farm-name" className="font-semibold">
          Farm name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="farm-name"
          required
          placeholder="e.g. Sunrise Game Fowl Farm"
          className="h-11 rounded-xl"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="farm-location" className="font-semibold">
          Location <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="farm-location"
          placeholder="e.g. Batangas, Philippines"
          className="h-11 rounded-xl"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="farm-description" className="font-semibold">
          Description <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="farm-description"
          placeholder="A short description of your farm (optional)"
          className="rounded-xl"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="flex justify-end">
        <Button
          type="submit"
          className="h-11 rounded-xl px-5 font-semibold"
          disabled={update.isPending || !name.trim()}
        >
          {update.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save changes
        </Button>
      </div>
    </form>
  );
}
