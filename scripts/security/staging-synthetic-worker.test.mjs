import test from "node:test";
import assert from "node:assert/strict";
import worker from "./staging-synthetic-worker.mjs";
const base = "https://staging.jogomanager.com";
test("no Worker bindings, cloud APIs, or production origins are allowed", async () => {
 const response = await worker.fetch(new Request(base+"/__security/health"), {});
 assert.equal(response.status,200);
 assert.equal(response.headers.get("X-PFM-Isolated-Stage"),"yes");
 const data=await response.json();
 assert.equal(data.production_access,false);
 assert.equal(data.stripe,"not-connected");
 const unsafe=await worker.fetch(new Request(base+"/"), {SUPABASE_SERVICE_ROLE_KEY:"should-not-be-used"});
 assert.equal(unsafe.status,503);
});
test("synthetic login never connects to production and requires a valid mock session", async () => {
 const noCookie=await worker.fetch(new Request(base+"/dashboard"),{});
 assert.equal(noCookie.status,401);
 const login=await worker.fetch(new Request(base+"/api/auth/login", {
   method:"POST",
   headers:{"Content-Type":"application/x-www-form-urlencoded"},
   body:"username=zap-synthetic&password=synthetic-not-a-secret"
 }),{});
 assert.equal(login.status,303);
 assert.match(login.headers.get("set-cookie")??"",/Secure; HttpOnly; SameSite=Lax/);
 const dashboard=await worker.fetch(new Request(base+"/dashboard",{headers:{"Cookie":"pfm_stage_session=synthetic-only"}}),{});
 assert.equal(dashboard.status,200);
});
test("all writes are synthetic, no Stripe calls, real saves or real rooms", async () => {
 const headers={"Cookie":"pfm_stage_session=synthetic-only"};
 for(const path of ["/api/saves","/api/checkout","/api/multiplayer/match"]){
   const response=await worker.fetch(new Request(base+path,{method:"POST",headers}),{});
   assert.equal(response.status<300,true);
   const payload=await response.json();
   assert.equal(payload.mock,true);
   if("stripe_called" in payload) assert.equal(payload.stripe_called,false);
   if("persisted" in payload) assert.equal(payload.persisted,false);
 }
});
test("the staged public forms cover authentication, saves, checkout and multiplayer", async () => {
 for(const [path,fragment] of [
  ["/auth", 'action="/api/auth/login"'],
  ["/saves", 'action="/api/saves"'],
  ["/checkout", 'action="/api/checkout"'],
  ["/multiplayer", 'action="/api/multiplayer/match"']
 ]) {
   const response=await worker.fetch(new Request(base+path),{});
   assert.equal(response.status,200, path);
   assert.ok((await response.text()).includes(fragment),path);
 }
});
