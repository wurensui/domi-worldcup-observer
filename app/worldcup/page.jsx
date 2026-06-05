import SportsViewingPage from "../../components/SportsViewingPage";
import worldcupEvent from "../../data/specialEvents/worldcup.json";

export const metadata = {
  title: "DOMI WORLD CUP NIGHTS | 世界杯屋顶观赛季",
  description: "DOMI 多米花园世界杯期间特别运营专题：屋顶花园、大屏观赛、朋友桌、互动游戏与观赛预约。"
};

export default function WorldcupPage() {
  return <SportsViewingPage event={worldcupEvent} />;
}
