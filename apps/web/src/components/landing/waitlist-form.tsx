"use client";

import { Button } from "@moneyroad-app/ui/components/button";
import { Input } from "@moneyroad-app/ui/components/input";
import { useId, useState } from "react";
import { toast } from "sonner";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type WaitlistFormProps = {
  /** Visual tone: light form on light bg, or inverted form on the dark CTA band. */
  variant?: "default" | "onDark";
};

export function WaitlistForm({ variant = "default" }: WaitlistFormProps) {
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!EMAIL_PATTERN.test(email)) {
      toast.error("올바른 이메일 주소를 입력해 주세요.");
      return;
    }

    // NOTE: 사전등록 저장은 후속 작업. 현재는 프론트 목업으로 성공 처리만 한다.
    toast.success("사전등록이 완료됐어요. 출시되면 가장 먼저 알려드릴게요!");
    setSubmitted(true);
    setEmail("");
  };

  const onDark = variant === "onDark";

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
        id={emailId}
        inputMode="email"
        onChange={(event) => setEmail(event.target.value)}
        placeholder="이메일 주소를 입력하세요"
        type="email"
        value={email}
      />
      <Button
        className="h-12 rounded-xl bg-[#256EF4] px-6 font-semibold text-base text-white hover:bg-[#0B50D0]"
        type="submit"
      >
        출시 알림 받기
      </Button>
    </form>
  );
}
