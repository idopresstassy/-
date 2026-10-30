import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const categories = [{value:"novel",label:"소설"},{value:"poetry",label:"시"},{value:"essay",label:"수필·에세이"},{value:"children",label:"동화"},{value:"other",label:"기타"}] as const;
type Category = typeof categories[number]["value"];
const empty = {title:"",penName:"",category:"novel" as Category,description:"",content:""};
export default function Creative() {
 const {user,isAuthenticated}=useAuth();
 const [form,setForm]=useState(empty);
 const [editing,setEditing]=useState<number|null>(null);
 const [selected,setSelected]=useState<number|null>(null);
 const utils=trpc.useUtils();
 const published=trpc.creative.list.useQuery();
 const mine=trpc.creative.mine.useQuery(undefined,{enabled:isAuthenticated});
 const detail=trpc.creative.get.useQuery({id:selected!},{enabled:selected!==null});
 const create=trpc.creative.create.useMutation({onSuccess:()=>{toast.success("임시 저장했습니다");setForm(empty);setEditing(null);utils.creative.mine.invalidate()},onError:e=>toast.error(e.message)});
 const update=trpc.creative.update.useMutation({onSuccess:()=>{toast.success("수정했습니다");setForm(empty);setEditing(null);utils.creative.mine.invalidate()},onError:e=>toast.error(e.message)});
 const submit=trpc.creative.submit.useMutation({onSuccess:()=>{toast.success("관리자 승인 요청을 보냈습니다");utils.creative.mine.invalidate()},onError:e=>toast.error(e.message)});
 const save=()=>{if(!form.title.trim()||!form.penName.trim()){toast.error("제목과 필명을 입력해주세요");return}
 if(editing!==null) update.mutate({id:editing,...form});else create.mutate(form);};
 return <div className="container max-w-4xl py-8 space-y-6">
 <Link href="/" className="text-sm underline">← 무료책방 메인으로</Link>
 <h1 className="text-3xl font-bold">창작 작품 · 나의 작품</h1>
 <p className="text-muted-foreground">직접 쓴 소설, 시, 수필, 동화를 무료로 소개하세요. 관리자 승인 후 공개됩니다.</p>
 <section className="rounded-xl border p-5 space-y-3"><h2 className="font-bold text-xl">공개된 창작 작품</h2>
 {published.isError && <p role="alert">작품을 불러올 수 없습니다. 관리자에게 문의해주세요.</p>}
 {published.data?.length===0 && <p className="text-muted-foreground">아직 공개된 작품이 없습니다.</p>}
 {published.data?.map(w=><button key={w.id} className="block text-left border rounded p-3 w-full" onClick={()=>setSelected(w.id)}><strong>{w.title}</strong> — {w.pen_name}</button>)}
 {selected!==null && <article className="border rounded p-4 space-y-3"><Button variant="outline" onClick={()=>setSelected(null)}>닫기</Button>
 {detail.data && <><h3 className="text-xl font-bold">{detail.data.title}</h3><p>{detail.data.pen_name}</p><p>{detail.data.description}</p><div className="whitespace-pre-wrap break-words leading-8">{detail.data.content}</div></>}</article>}
 </section>
 {!isAuthenticated ? <p className="border rounded p-4">작품을 올리려면 먼저 <Link className="underline font-semibold" href="/login">로그인</Link>해주세요.</p> :
 <>
 <section className="border rounded-xl p-5 space-y-3"><h2 className="text-xl font-bold">{editing===null?"새 작품 작성":"내 작품 수정"}</h2>
 <label className="block">작품 제목<Input maxLength={200} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
 <label className="block">필명<Input maxLength={100} value={form.penName} onChange={e=>setForm({...form,penName:e.target.value})}/></label>
 <label className="block">종류<select className="block w-full border p-2 rounded bg-background" value={form.category} onChange={e=>setForm({...form,category:e.target.value as Category})}>{categories.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
 <label className="block">소개<Textarea maxLength={3000} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
 <label className="block">작품 본문<Textarea rows={12} maxLength={300000} value={form.content} onChange={e=>setForm({...form,content:e.target.value})}/></label>
 <p className="text-xs text-muted-foreground">본인이 권리를 가진 작품만 등록해주세요. 임시 저장 후 승인 신청할 수 있습니다. 파일 첨부·연재 기능은 추후 추가됩니다.</p>
 <Button onClick={save} disabled={create.isPending||update.isPending}>임시 저장</Button>
 {editing!==null && <Button variant="outline" className="ml-2" onClick={()=>{setEditing(null);setForm(empty)}}>취소</Button>}
 </section>
 <section className="border rounded-xl p-5 space-y-3"><h2 className="text-xl font-bold">내 작품 관리</h2>
 {mine.data?.length===0 && <p>등록한 작품이 없습니다.</p>}
 {mine.data?.map(w=><div className="border rounded p-3 space-y-2" key={w.id}>
 <strong>{w.title}</strong> <span className="text-sm">({({draft:"임시 저장",pending:"승인 대기",published:"공개",rejected:"반려",hidden:"비공개"} as Record<string,string>)[w.status]??w.status})</span>
 {w.review_note && <p className="text-sm">관리자 안내: {w.review_note}</p>}
 <div className="flex gap-2 flex-wrap">
 {(w.status==="draft"||w.status==="rejected") && <><Button variant="outline" size="sm" onClick={()=>{setEditing(w.id);setForm({title:w.title,penName:w.pen_name,category:w.category as Category,description:w.description,content:w.content});window.scrollTo({top:0,behavior:"smooth"})}}>수정</Button><Button size="sm" disabled={!w.content.trim()||submit.isPending} onClick={()=>submit.mutate({id:w.id})}>승인 신청</Button></>}
 </div></div>)}
 </section></>}
 </div>;
}
