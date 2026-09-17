"use client";

import { useActionState } from "react";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { createCompanyAction, type CreateCompanyActionState } from "@/features/employers/createCompanyAction";

const initialState: CreateCompanyActionState = {};

export function CreateCompanyForm() {
  const [state, formAction, isPending] = useActionState(createCompanyAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Input
        label="Company name"
        name="name"
        required
        autoComplete="organization"
        maxLength={200}
      />
      {state.error ? (
        <p role="alert" className="text-sm text-danger-600">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" fullWidth disabled={isPending}>
        {isPending ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}
