"use client";

import { Button } from "@moneyroad-app/ui/components/button";
import { Input } from "@moneyroad-app/ui/components/input";
import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import z from "zod";
import { orpc } from "@/utils/orpc";

const emailSchema = z
  .string()
  .trim()
  .email("올바른 이메일 주소를 입력해 주세요.");

type WaitlistFormProps = {
  /** Visual tone: light form on light bg, or inverted form on the dark CTA band. */
  variant?: "default" | "onDark";
};

export function WaitlistForm({ variant = "default" }: WaitlistFormProps) {
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const joinWaitlist = useMutation(
    orpc.waitlist.join.mutationOptions({
      onSuccess: () => {
        toast.success(
          "사전등록이 완료됐어요. 출시되면 가장 먼저 알려드릴게요!"
        );
        setSubmitted(true);
        setEmail("");
      },
      onError: () => {
        toast.error("등록에 실패했어요. 잠시 후 다시 시도해 주세요.");
      },
    })
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      toast.error(
        parsed.error.issues[0]?.message ?? "올바른 이메일 주소를 입력해 주세요."
      );
      return;
    }

    joinWaitlist.mutate({ email: parsed.data });
  };

  const onDark = variant === "onDark";
  const pending = joinWaitlist.isPending;

  if (submitted) {
    return (
      <p
        className={`rounded-xl px-5 py-4 text-center font-medium text-sm ${
          onDark ? "bg-white/10 text-white" : "bg-[#ECF2FE] text-[#0B50D0]"
        }`}
      >
        🎉 사전등록 완료! 출시 소식을 이메일로 보내드릴게요.
      </p>
    );
  }

  return (
    <form
      className="flex w-full flex-col gap-2.5 sm:flex-row"
      onSubmit={handleSubmit}
    >
      <label className="sr-only" htmlFor={emailId}>
        이메일 주소
      </label>
      <Input
        autoComplete="email"
        className={`h-12 flex-1 rounded-xl text-base ${
          onDark
            ? "border-white/25 bg-white/10 text-white placeholder:text-white/60"
            : "border-[#CDD1D5] bg-white"
        }`}
        disabled={pending}
        id={emailId}
        inputMode="email"
        onChange={(event) => setEmail(event.target.value)}
        placeholder="이메일 주소를 입력하세요"
        type="email"
        value={email}
      />
      <Button
        className="h-12 rounded-xl bg-[#256EF4] px-6 font-semibold text-base text-white hover:bg-[#0B50D0]"
        disabled={pending}
        type="submit"
      >
        {pending ? "등록 중..." : "출시 알림 받기"}
      </Button>
    </form>
  );
}
