import { getSupabaseAdmin } from "./supabase";

export type CreativeCategory = "novel" | "poetry" | "essay" | "children" | "other";
type CreativeStatus = "draft" | "pending" | "published" | "rejected" | "hidden";
const table = () => getSupabaseAdmin().from("creative_works");
const check = (error: unknown) => { if (error) throw error; };
const fields = "id,user_id,title,pen_name,category,description,content,status,review_note,created_at,updated_at,published_at";

export async function publicWorks() {
  const { data, error } = await table().select(fields).eq("status","published").order("published_at",{ascending:false}).limit(200);
  check(error); return data ?? [];
}
export async function myWorks(userId: string) {
  const { data, error } = await table().select(fields).eq("user_id",userId).order("updated_at",{ascending:false});
  check(error); return data ?? [];
}
export async function pendingWorks() {
  const { data, error } = await table().select(fields).eq("status","pending").order("created_at",{ascending:true});
  check(error); return data ?? [];
}
export async function getWork(id:number, userId?:string, isAdmin=false) {
  const { data, error } = await table().select(fields).eq("id",id).maybeSingle(); check(error);
  if (!data || (data.status !== "published" && data.user_id !== userId && !isAdmin)) return null;
  return data;
}
export async function createWork(userId:string, input:{title:string;penName:string;category:CreativeCategory;description:string;content:string}) {
  const {data,error}=await table().insert({user_id:userId,title:input.title.trim(),pen_name:input.penName.trim(),category:input.category,description:input.description,content:input.content,status:"draft"}).select("id").single();
  check(error); return Number(data!.id);
}
export async function updateWork(id:number,userId:string,input:{title:string;penName:string;category:CreativeCategory;description:string;content:string}) {
  // 게시된 원고를 직접 덮어쓰지 않습니다. 승인 전인 자신의 원고만 편집합니다.
  const {data,error}=await table().update({title:input.title.trim(),pen_name:input.penName.trim(),category:input.category,description:input.description,content:input.content,status:"draft",review_note:null,updated_at:new Date().toISOString()}).eq("id",id).eq("user_id",userId).in("status",["draft","rejected"]).select("id");
  check(error); return (data?.length ?? 0)>0;
}
export async function submitWork(id:number,userId:string) {
  const {data,error}=await table().update({status:"pending",review_note:null,updated_at:new Date().toISOString()}).eq("id",id).eq("user_id",userId).in("status",["draft","rejected"]).neq("content","").select("id");
  check(error);return (data?.length??0)>0;
}
export async function reviewWork(id:number,status:"published"|"rejected",note:string) {
  const {data,error}=await table().update({status,review_note:note.trim() || null,updated_at:new Date().toISOString(),...(status==="published"?{published_at:new Date().toISOString()}:{})}).eq("id",id).eq("status","pending").select("id");
  check(error);return (data?.length??0)>0;
}
