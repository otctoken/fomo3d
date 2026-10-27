-- Run in your Supabase SQL editor. Only the indexer service role may write.
create table if not exists public.fomo_events (
 network text not null, package_id text not null, id text not null,
 checkpoint numeric(20,0) not null, bcs text not null, event jsonb not null,
 primary key(network, package_id, id)
);
create index if not exists fomo_events_checkpoint on public.fomo_events(network,package_id,checkpoint);
create table if not exists public.fomo_cursors (
 network text not null, package_id text not null, module text not null, chain text not null,
 cursor text, initialized boolean not null default false, complete boolean not null default false,
 updated_at timestamptz not null default now(), primary key(network,package_id,module)
);
alter table public.fomo_events enable row level security;
alter table public.fomo_cursors enable row level security;
drop policy if exists public_read_events on public.fomo_events;
create policy public_read_events on public.fomo_events for select to anon, authenticated using (true);
drop policy if exists public_read_cursors on public.fomo_cursors;
create policy public_read_cursors on public.fomo_cursors for select to anon, authenticated using (true);
grant select on public.fomo_events,public.fomo_cursors to anon,authenticated;
revoke insert,update,delete on public.fomo_events,public.fomo_cursors from anon,authenticated;
create or replace function public.save_fomo_page(
 p_network text,p_package text,p_module text,p_chain text,p_previous_cursor text,p_cursor text,
 p_initialized boolean,p_complete boolean,p_events jsonb
) returns void language plpgsql security definer set search_path=public as $$
declare previous public.fomo_cursors;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_network||p_package||p_module,0));
 select * into previous from public.fomo_cursors where network=p_network and package_id=p_package and module=p_module for update;
 if found and (previous.chain<>p_chain or previous.cursor is distinct from p_previous_cursor) then
  raise exception 'Indexer cursor conflict or chain reset';
 end if;
 insert into public.fomo_events(network,package_id,id,checkpoint,bcs,event)
 select p_network,p_package,e->>'id',(e->>'checkpoint')::numeric,e->>'bcs',e->'event' from jsonb_array_elements(p_events) e
 on conflict(network,package_id,id) do nothing;
 insert into public.fomo_cursors(network,package_id,module,chain,cursor,initialized,complete,updated_at)
 values(p_network,p_package,p_module,p_chain,p_cursor,p_initialized,p_complete,now())
 on conflict(network,package_id,module) do update set cursor=excluded.cursor,initialized=excluded.initialized,complete=excluded.complete,updated_at=now();
end; $$;
revoke all on function public.save_fomo_page(text,text,text,text,text,text,boolean,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.save_fomo_page(text,text,text,text,text,text,boolean,boolean,jsonb) to service_role;
