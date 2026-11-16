/**
 * Every game action the screens can take, in one place.
 *  - Mock mode (VITE_MOCK unset / 1): runs against the browser-only mock.
 *  - Live mode (VITE_MOCK=0): calls the Supabase database functions (they check every rule) and then
 *    reloads the player's state.
 * All actions are async, so callers await them and show errors from the database as toasts.
 */
import { MOCK, getState, mock, type MockGangster } from "./mock";
import { platform, type Announcement } from "./mock/platform";
import { rpc } from "./backend/supabase";
import { refresh, refreshPlatform } from "./backend/live";
import type { WeaponId } from "./config/game";

type Item = WeaponId | "vest" | "medkit";
type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v ?? 0);

/** Deposits move real money: they only go live with the payment server that confirms them on-chain. */
const DEPOSITS_SOON = "Deposits open soon: the payment server that confirms transfers on Solana isn't live yet.";

async function live<T>(fn: () => Promise<T>): Promise<T> {
  const out = await fn();
  await refresh();
  return out;
}

const findGangster = (id: number) => getState().gangsters.find((g) => g.id === id);

export const game = {
  async createGang(protagonist: 1 | 2, name: string) {
    if (MOCK) return void mock.createGang(protagonist, name);
    await live(() => rpc("found_gang", { p_protagonist: protagonist, p_name: name }));
  },

  async deposit(usdc: number) {
    if (MOCK) return void mock.deposit(usdc);
    throw new Error(DEPOSITS_SOON);
  },

  async withdraw(dc: number) {
    if (MOCK) return void mock.withdraw(dc);
    await live(() => rpc("request_withdrawal_usdc", { p_amount_dc: dc }));
  },

  async depositAmmo(amount: number) {
    if (MOCK) return void mock.depositAmmo(amount);
    throw new Error(DEPOSITS_SOON);
  },

  async withdrawAmmo(amount: number) {
    if (MOCK) return void mock.withdrawAmmo(amount);
    await live(() => rpc("request_withdrawal_ammo", { p_amount: amount }));
  },

  async buyBoxes(count: number): Promise<{ totalDc: number; savedDc: number }> {
    if (MOCK) return mock.buyBoxes(count);
    const r = await live(() => rpc<Row>("buy_boxes", { p_count: count }));
    return { totalDc: num(r.total_dc), savedDc: num(r.saved_dc) };
  },

  /** Opens boxes one by one and returns the new gangsters. */
  async openBoxes(ids: number[]): Promise<MockGangster[]> {
    if (MOCK) return ids.map((id) => mock.openBox(id));
    const opened: number[] = [];
    for (const id of ids) {
      const r = await rpc<Row>("open_box", { p_box_id: id });
      opened.push(num(r.gangster_id));
    }
    await refresh();
    return opened.map((id) => findGangster(id)).filter((g): g is MockGangster => !!g);
  },

  async deploy(ids: number[]) {
    if (MOCK) return void mock.deploy(ids);
    await live(() => rpc("deploy", { p_ids: ids }));
  },

  async claim(id: number): Promise<number> {
    if (MOCK) return mock.claim(id);
    return num(await live(() => rpc("claim", { p_gangster_id: id })));
  },

  async claimAll(ids?: number[]): Promise<{ net: number; fee: number }> {
    if (MOCK) return mock.claimAll(ids);
    const r = await live(() => rpc<Row>("claim_all", { p_ids: ids ?? null }));
    return { net: num(r.dc), fee: num(r.fee_ammo) };
  },

  async fuse(rarity: number): Promise<{ parents: readonly [MockGangster, MockGangster]; child: MockGangster; payout: number; fee: number }> {
    if (MOCK) return mock.fuse(rarity);
    const before = getState().gangsters;
    const r = await rpc<Row>("fuse", { p_rarity: rarity });
    const parentIds = (r.parents as number[]).map(Number);
    const parents = parentIds.map((id) => before.find((g) => g.id === id)!) as unknown as readonly [MockGangster, MockGangster];
    await refresh();
    const child = findGangster(num(r.child_id))!;
    return { parents, child, payout: num(r.payout_dc), fee: num(r.fee_ammo) };
  },

  async buyItem(item: Item, count: number) {
    if (MOCK) return void mock.buyItem(item, count);
    await live(() => rpc("buy_item", { p_item: item, p_count: count }));
  },

  async heal(ids: number[]): Promise<{ healed: number; bought: number; cost: number }> {
    if (MOCK) return mock.heal(ids);
    const r = await live(() => rpc<Row>("heal", { p_ids: ids }));
    return { healed: num(r.healed), bought: num(r.bought), cost: num(r.cost_ammo) };
  },

  async equipWeapon(id: number, weapon: WeaponId) {
    if (MOCK) return void mock.equipWeapon(id, weapon);
    await live(() => rpc("equip_weapon", { p_gangster_id: id, p_weapon: weapon }));
  },

  async equipVest(id: number) {
    if (MOCK) return void mock.equipVest(id);
    await live(() => rpc("equip_vest", { p_gangster_id: id }));
  },

  // ---------------------------------------------------------------- admin (the database checks the admin list)

  async grantDc(wallet: string, amount: number) {
    if (MOCK) return void mock.grantDc(amount);
    await rpc("admin_grant_dc", { p_wallet: wallet, p_amount: amount });
  },

  async grantBoxes(wallet: string, count: number) {
    if (MOCK) return void mock.grantBoxes(count);
    await rpc("admin_grant_boxes", { p_wallet: wallet, p_count: count });
  },

  async setMaintenance(on: boolean, message: string, by: string) {
    if (MOCK) return void platform.setMaintenance(on, message, by);
    await rpc("admin_set_maintenance", { p_on: on, p_message: message });
    await refreshPlatform();
  },

  async announce(a: Omit<Announcement, "id" | "createdAt">, by: string) {
    if (MOCK) return void platform.announce(a, by);
    await rpc("admin_announce", {
      p_kind: a.kind,
      p_title: a.title,
      p_message: a.message,
      p_expires_at: a.expiresAt ? new Date(a.expiresAt).toISOString() : null,
    });
    await refreshPlatform();
  },

  async clearAnnouncement(by: string) {
    if (MOCK) return void platform.clearAnnouncement(by);
    await rpc("admin_clear_announcement");
    await refreshPlatform();
  },
};
