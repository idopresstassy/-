import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
export default function CreativeAdmin(){
 const {user,loading}=useAuth();
 const [notes,setNotes]=useState<Record<number,string>>({});
 const utils=trpc.useUtils();
 const pending=trpc.creative.pending.useQuery(undefined,{enabled:user?.role==="admin"});
 const review=trpc.creative.review.useMutation({onSuccess:()=>{toast.success("처리했습니다");utils.creative.pending.invalidate();utils.creative.list.invalidate()},onError:e=>toast.error(e.message)});
 if(loading)return <div className="container py-8">확인 중...</div>;
 if(user?.role!=="admin")return <div className="container py-8">관리자 권한이 필요합니다.</div>;
 return <div className="container max-w-4xl py-8 space-y-5"><Link href="/admin" className="underline">← 관리자 페이지</Link><h1 className="text-2xl font-bold">창작 작품 승인 관리</h1>
 {pending.isError&&<p role="alert">승인 대기 목록을 불러오지 못했습니다. 데이터베이스 마이그레이션을 확인해주세요.</p>}
 {pending.data?.length===0&&<p>승인 대기 작품이 없습니다.</p>}
 {pending.data?.map(w=><section key={w.id} className="border rounded-xl p-5 space-y-3">
 <h2 className="text-xl font-semibold">{w.title} · {w.pen_name}</h2><p>{w.description}</p>
 <div className="whitespace-pre-wrap max-h-96 overflow-auto border p-4 break-words">{w.content}</div>
 <label className="block">검토 안내<textarea className="border rounded w-full p-3" value={notes[w.id]??""} onChange={e=>setNotes({...notes,[w.id]:e.target.value})}/></label>
 <div className="flex gap-2"><Button disabled={review.isPending} onClick={()=>review.mutate({id:w.id,status:"published",note:notes[w.id]??""})}>승인</Button>
 <Button variant="outline" disabled={review.isPending||!(notes[w.id]??"").trim()} onClick={()=>review.mutate({id:w.id,status:"rejected",note:notes[w.id]??""})}>반려</Button></div>
 </section>)}
 </div>;
}
