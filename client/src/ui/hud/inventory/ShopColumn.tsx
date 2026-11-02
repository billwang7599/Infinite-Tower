import {
  bagCounts, COIN_LETTER, COINS, exchangeRate, formatPrice, itemDef, moneyIn, type CoinId, type Gear, type ItemId,
  type ShopView,
} from "@infinite-tower/shared";
import { NO_FOCUS } from "../../components/noFocus.js";
import { BUTTON } from "../../components/styles.js";
import { ItemPicture } from "./BagGrid.js";
import { EQUIPMENT_WIDTH_PX } from "./grid.js";
import { RARITY_TEXT } from "./itemInfo.js";

// A greatsword, 4 cells tall, at 1 screen pixel per art pixel.
const PICTURE_PX = 64;
const SMALL_BUTTON = `${BUTTON.primary} px-2.5! py-1! text-xs!`;
const EXCHANGES = COINS.flatMap((coin, i) => {
  const smaller = COINS[i + 1];
  return smaller ? [[coin, smaller], [smaller, coin]] as [CoinId, CoinId][] : [];
});

interface ShopColumnProps {
  shop: ShopView;
  gear: Gear;
  buy: (item: ItemId) => void;
  exchange: (from: CoinId, to: CoinId) => void;
}

export function ShopColumn({ shop, gear, buy, exchange }: ShopColumnProps) {
  const money = moneyIn(gear.bag, gear.cloth);
  const bag = bagCounts(gear.bag), cloth = bagCounts(gear.cloth);
  const coins = (coin: CoinId) => (bag[coin] ?? 0) + (cloth[coin] ?? 0);
  const discounted = shop.stock.some((s) => s.price < s.fullPrice);
  const buys = Object.keys(shop.buys) as ItemId[];
  return (
    <div id="shop" className="flex flex-col gap-3 text-sm" style={{ width: EQUIPMENT_WIDTH_PX }}>
      {shop.stock.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {shop.stock.map(({ item, price, fullPrice }) => (
            <li key={item} data-item={item} className="flex items-center gap-2.5 rounded-sm bg-black/40 p-1.5">
              <div className="relative size-16 shrink-0 rounded-sm border border-white/10 bg-black/60">
                <ItemPicture item={item} turned={false} maxPx={PICTURE_PX} />
              </div>
              <div className="min-w-0 flex-1">
                <div className={`truncate ${RARITY_TEXT[itemDef(item).rarity]}`}>{itemDef(item).name}</div>
                <div className="text-xs tabular-nums">
                  <span className="text-victory">{formatPrice(price)}</span>
                  {price < fullPrice && (
                    <span className="ml-1.5 text-white/40 line-through">{formatPrice(fullPrice)}</span>
                  )}
                </div>
              </div>
              <button
                type="button" {...NO_FOCUS} className={SMALL_BUTTON} disabled={money < price}
                data-buy={item} onClick={() => buy(item)}
              >
                Buy
              </button>
            </li>
          ))}
        </ul>
      )}
      {discounted && <p className="text-xs text-white/50 italic">Your first purchase here is cheaper.</p>}
      {buys.length > 0 && (
        <p className="text-xs text-white/50">
          Buys {buys.map((item) => itemDef(item).name.toLowerCase()).join(", ")}: pick one in your bag to sell it.
        </p>
      )}
      <div className="flex flex-col gap-1.5 border-t border-white/10 pt-2.5">
        <div className="flex items-baseline justify-between">
          <span className="text-xs tracking-[0.12em] text-white/50 uppercase">Your coins</span>
          <span id="shop-money" className="font-semibold text-victory tabular-nums">{formatPrice(money)}</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {EXCHANGES.map(([from, to]) => {
            const { give, get } = exchangeRate(from, to)!;
            return (
              <button
                key={`${from}-${to}`} type="button" {...NO_FOCUS} className={SMALL_BUTTON} disabled={coins(from) < give}
                data-exchange={`${from}>${to}`} onClick={() => exchange(from, to)}
              >
                {give}{COIN_LETTER[from]} → {get}{COIN_LETTER[to]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
