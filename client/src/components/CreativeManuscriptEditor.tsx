import { useEffect, useId, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CREATIVE_GENRES } from "@shared/creative";
import { creativeManuscriptFieldsSchema, type CreativeManuscriptFields, type CreativeManuscriptTarget } from "@shared/creativeEditing";

export default function CreativeManuscriptEditor({ target, onClose, onSaved }: {
  target: CreativeManuscriptTarget;
  onClose: () => void;
  onSaved: () => void;
}) {
  const id = useId();
  const manuscript = trpc.admin.creativeManuscript.useQuery(target, {
    refetchOnWindowFocus: false, refetchOnReconnect: false,
  });
  const [draft, setDraft] = useState<CreativeManuscriptFields | null>(null);
  const [version, setVersion] = useState("");
  const [validationError, setValidationError] = useState("");
  const save = trpc.admin.updateCreativeManuscript.useMutation({ onSuccess: onSaved });
  useEffect(() => {
    // Wait for a fresh read; never replace edits with an automatic refetch.
    if (draft || manuscript.isFetching || !manuscript.data) return;
    const { title, authorName, genre, description, content, updatedAt } = manuscript.data;
    setDraft({ title, authorName, genre, description, content });
    setVersion(updatedAt);
  }, [draft, manuscript.data, manuscript.isFetching]);

  const dirty = Boolean(draft && manuscript.data &&
    (Object.keys(draft) as (keyof CreativeManuscriptFields)[])
      .some(key => draft[key] !== manuscript.data![key]));
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const close = () => {
    if (save.isPending) return;
    if (dirty && !window.confirm("저장하지 않은 수정 내용이 있습니다. 수정을 취소할까요?")) return;
    onClose();
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft || save.isPending) return;
    const result = creativeManuscriptFieldsSchema.safeParse(draft);
    if (!result.success) {
      const message = result.error.issues[0]?.message || "입력 내용을 확인해 주세요.";
      setValidationError(message);
      toast.error(message);
      return;
    }
    setValidationError("");
    save.mutate({ ...target, ...result.data, expectedUpdatedAt: version });
  };

  return (
    <Dialog open onOpenChange={open => { if (!open) close(); }}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl" onInteractOutside={event => event.preventDefault()}>
        <DialogHeader className="shrink-0 border-b p-5 pr-12">
          <DialogTitle>창작 원고 수정</DialogTitle>
          <DialogDescription>
            {target.kind === "submission"
              ? "수정 내용을 저장해도 검수 대기 상태로 유지됩니다. 공개하려면 저장 후 ‘승인하고 공개’를 눌러 주세요."
              : "게시 작품의 수정본을 저장합니다. 공개 중인 작품은 독자 화면에 반영되며, 게시 중단 작품은 비공개로 유지됩니다."}
          </DialogDescription>
        </DialogHeader>
        {!draft ? (
          <div className="p-8 text-center" role="status">
            {manuscript.isError ? <><p role="alert">{manuscript.error.message || "원고를 불러오지 못했습니다."}</p><Button className="mt-3" variant="outline" onClick={() => manuscript.refetch()}>다시 불러오기</Button></>
              : <p className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />원고를 불러오는 중...</p>}
          </div>
        ) : (
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <fieldset disabled={save.isPending} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label htmlFor={`${id}-title`} className="mb-1 block text-sm font-medium">제목</label><Input id={`${id}-title`} required maxLength={200} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></div>
                <div><label htmlFor={`${id}-author`} className="mb-1 block text-sm font-medium">작가명</label><Input id={`${id}-author`} required maxLength={120} value={draft.authorName} onChange={e => setDraft({ ...draft, authorName: e.target.value })} /></div>
              </div>
              <div><label htmlFor={`${id}-genre`} className="mb-1 block text-sm font-medium">작품 장르</label><select id={`${id}-genre`} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={draft.genre} onChange={e => setDraft({ ...draft, genre: e.target.value as CreativeManuscriptFields["genre"] })}>{CREATIVE_GENRES.map(genre => <option key={genre.value} value={genre.value}>{genre.label}</option>)}</select></div>
              <div><label htmlFor={`${id}-description`} className="mb-1 block text-sm font-medium">작품 소개</label><textarea id={`${id}-description`} className="w-full rounded-md border border-input bg-background p-3 text-sm" rows={3} maxLength={2000} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></div>
              <div>
                <label htmlFor={`${id}-content`} className="mb-1 block text-sm font-medium">원고 본문</label>
                <textarea id={`${id}-content`} className="min-h-64 w-full rounded-md border border-input bg-background p-3 text-base leading-7" rows={14} required minLength={20} maxLength={500000} value={draft.content} onChange={e => setDraft({ ...draft, content: e.target.value })} />
                <p className="mt-1 text-xs text-muted-foreground">{draft.content.length.toLocaleString()}자 / 최대 500,000자</p>
              </div>
            </fieldset>
            <div className="shrink-0 space-y-3 border-t bg-background p-4">
              {(validationError || save.error) && <p role="alert" className="text-sm text-destructive">{validationError || save.error?.message}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={close} disabled={save.isPending}>취소</Button>
                <Button type="submit" disabled={save.isPending || !dirty}>{save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{save.isPending ? "저장 중..." : "수정 내용 저장"}</Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
