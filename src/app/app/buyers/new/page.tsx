import { BuyerForm } from "@/components/buyer-forms";

export default function NewBuyerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">新建买家</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          WhatsApp 优先填写，方便列表里一键打开聊天。
        </p>
      </div>
      <BuyerForm />
    </div>
  );
}
