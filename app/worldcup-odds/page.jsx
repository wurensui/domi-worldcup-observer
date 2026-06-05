import WorldCupOddsBoard from "../../components/WorldCupOddsBoard";
import worldcupEvent from "../../data/specialEvents/worldcup.json";

export const metadata = {
  title: "World Cup 2026 Odds Desk",
  description: "Login-gated World Cup 2026 match odds and prediction board."
};

export default function WorldCupOddsPage() {
  return <WorldCupOddsBoard matches={worldcupEvent.matches} />;
}
