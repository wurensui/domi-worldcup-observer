import WorldCupAdminBoard from "../../components/WorldCupAdminBoard";
import worldcupEvent from "../../data/specialEvents/worldcup.json";

export const metadata = {
  title: "World Cup 2026 Admin",
  description: "World Cup 2026 customer, market and result management desk."
};

export default function WorldCupAdminPage() {
  return <WorldCupAdminBoard matches={worldcupEvent.matches} />;
}
