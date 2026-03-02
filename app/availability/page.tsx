"use client";

import blockedTimes from "@/app/data/member-blocked-times.json";
import { useMemo, useState, type CSSProperties } from "react";

type DayKey = "일" | "월" | "화" | "수" | "목" | "금" | "토";

type MemberBlockedSchedule = {
  times: string[];
  time_point: DayKey;
};

type MemberBlockedTimes = {
  name: string;
  schedules: MemberBlockedSchedule[];
};

const DAY_ORDER: DayKey[] = ["일", "월", "화", "수", "목", "금", "토"];
const DAY_TIME_SLOTS = Array.from({ length: 48 }, (_, index) => {
  const hour = String(Math.floor(index / 2)).padStart(2, "0");
  const minute = index % 2 === 0 ? "00" : "30";
  return `${hour}:${minute}`;
});
const DISPLAY_TIME_SLOTS = DAY_TIME_SLOTS.filter((time) => Number(time.slice(0, 2)) >= 9);
const ALL_SLOTS_SET = new Set(DAY_TIME_SLOTS);
const TEAM_FILTERS: { key: string; label: string; members: string[] }[] = [
  { key: "planning", label: "기획", members: ["주희연"] },
  { key: "design", label: "디자인", members: ["김은홍"] },
  { key: "frontend", label: "프론트", members: ["최호", "최용원", "이만재", "박유민", "이경준", "배지영"] },
  { key: "backend", label: "백엔드", members: ["한상호", "이준교", "이호연"] },
  { key: "backend-review", label: "백엔드리뷰", members: ["문희상"] }
];

const members = blockedTimes as MemberBlockedTimes[];

function getAvailableByDay(member: MemberBlockedTimes): Record<DayKey, Set<string>> {
  const blockedByDay = {
    일: new Set<string>(),
    월: new Set<string>(),
    화: new Set<string>(),
    수: new Set<string>(),
    목: new Set<string>(),
    금: new Set<string>(),
    토: new Set<string>()
  };

  for (const schedule of member.schedules) {
    for (const time of schedule.times) {
      blockedByDay[schedule.time_point].add(time);
    }
  }

  return {
    일: new Set([...ALL_SLOTS_SET].filter((slot) => !blockedByDay.일.has(slot))),
    월: new Set([...ALL_SLOTS_SET].filter((slot) => !blockedByDay.월.has(slot))),
    화: new Set([...ALL_SLOTS_SET].filter((slot) => !blockedByDay.화.has(slot))),
    수: new Set([...ALL_SLOTS_SET].filter((slot) => !blockedByDay.수.has(slot))),
    목: new Set([...ALL_SLOTS_SET].filter((slot) => !blockedByDay.목.has(slot))),
    금: new Set([...ALL_SLOTS_SET].filter((slot) => !blockedByDay.금.has(slot))),
    토: new Set([...ALL_SLOTS_SET].filter((slot) => !blockedByDay.토.has(slot)))
  };
}

export default function AvailabilityPage() {
  const [selectedMembers, setSelectedMembers] = useState<string[]>(() => members.map((member) => member.name));

  const availableMapByName = useMemo(() => {
    const map = new Map<string, Record<DayKey, Set<string>>>();
    for (const member of members) {
      map.set(member.name, getAvailableByDay(member));
    }
    return map;
  }, []);

  const memberNames = useMemo(() => members.map((member) => member.name), []);
  const isAllSelected = selectedMembers.length === memberNames.length;

  const toggleMember = (name: string) => {
    setSelectedMembers((previous) =>
      previous.includes(name) ? previous.filter((memberName) => memberName !== name) : [...previous, name]
    );
  };

  const toggleTeam = (teamMembers: string[]) => {
    setSelectedMembers((previous) => {
      const isTeamSelected = teamMembers.every((memberName) => previous.includes(memberName));
      if (isTeamSelected) {
        return previous.filter((memberName) => !teamMembers.includes(memberName));
      }
      const merged = new Set([...previous, ...teamMembers]);
      return [...merged];
    });
  };

  const getAvailableCount = (day: DayKey, time: string): number => {
    if (selectedMembers.length === 0) {
      return 0;
    }

    let count = 0;
    for (const name of selectedMembers) {
      if (availableMapByName.get(name)?.[day].has(time)) {
        count += 1;
      }
    }
    return count;
  };

  const getAvailableNames = (day: DayKey, time: string): string[] =>
    memberNames.filter((name) => selectedMembers.includes(name) && Boolean(availableMapByName.get(name)?.[day].has(time)));

  const visibleTimeSlots = useMemo(
    () => DISPLAY_TIME_SLOTS.filter((time) => DAY_ORDER.some((day) => getAvailableCount(day, time) > 0)),
    [selectedMembers, availableMapByName]
  );

  const maxAvailableCount = useMemo(() => {
    let maxCount = 0;
    for (const time of visibleTimeSlots) {
      for (const day of DAY_ORDER) {
        maxCount = Math.max(maxCount, getAvailableCount(day, time));
      }
    }
    return maxCount;
  }, [visibleTimeSlots, selectedMembers, availableMapByName]);

  const getCellStyle = (availableCount: number): CSSProperties | undefined => {
    if (availableCount <= 0 || maxAvailableCount <= 0) {
      return undefined;
    }

    const ratio = availableCount / maxAvailableCount;
    const lightness = 94 - ratio * 38;
    const saturation = 46 + ratio * 26;

    return {
      backgroundColor: `hsl(145 ${saturation}% ${lightness}%)`,
      color: ratio > 0.65 ? "#0f2f1b" : "#1f5130",
      fontWeight: 700
    };
  };

  return (
    <main className="availability-page">
      <section className="availability-shell">
        <header className="availability-header">
          <h1>주간 가능시간 캘린더</h1>
          <p>입력된 불가시간을 제외한 가능한 시간만 표시됩니다.</p>
          <p>색이 진할수록 가능한 인원이 많고, 테두리 강조 칸이 현재 최댓값입니다.</p>
        </header>

        <div className="availability-filter-panel" role="group" aria-label="멤버 필터">
          <div className="availability-filter-row" aria-label="전체 및 팀 필터">
            <button
              type="button"
              className={`availability-filter-chip ${isAllSelected ? "is-active" : ""}`}
              aria-pressed={isAllSelected}
              onClick={() => setSelectedMembers(isAllSelected ? [] : memberNames)}
            >
              전체
            </button>
            {TEAM_FILTERS.map((team) => {
              const isActive = team.members.every((memberName) => selectedMembers.includes(memberName));
              return (
                <button
                  key={team.key}
                  type="button"
                  className={`availability-filter-chip availability-filter-chip-team ${isActive ? "is-active" : ""}`}
                  aria-pressed={isActive}
                  onClick={() => toggleTeam(team.members)}
                >
                  {team.label}
                </button>
              );
            })}
          </div>
          <div className="availability-filter-row" aria-label="개인 필터">
            {memberNames.map((name) => (
              <button
                key={name}
                type="button"
                className={`availability-filter-chip ${selectedMembers.includes(name) ? "is-active" : ""}`}
                aria-pressed={selectedMembers.includes(name)}
                onClick={() => toggleMember(name)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        <div className="availability-grid-wrap">
          <table className="availability-grid">
            <thead>
              <tr>
                <th scope="col">시간</th>
                {DAY_ORDER.map((day) => (
                  <th key={day} scope="col">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleTimeSlots.map((time) => (
                <tr key={time}>
                  <th scope="row">{time}</th>
                  {DAY_ORDER.map((day) => {
                    const availableNames = getAvailableNames(day, time);
                    const availableCount = availableNames.length;
                    const isAvailable = availableCount > 0;
                    return (
                      <td
                        key={`${day}-${time}`}
                        className={`${isAvailable ? "cell-available" : "cell-unavailable"} ${
                          isAvailable && availableCount === maxAvailableCount ? "cell-best" : ""
                        }`}
                        style={getCellStyle(availableCount)}
                        title={
                          isAvailable && selectedMembers.length > 1
                            ? `가능 인원 (${availableCount}명)\n${availableNames.join(", ")}`
                            : undefined
                        }
                        aria-label={
                          selectedMembers.length <= 1
                            ? `${day} ${time} ${isAvailable ? "가능" : "불가"}`
                            : `${day} ${time} 가능 인원 ${availableCount}명`
                        }
                      >
                        {isAvailable
                          ? selectedMembers.length <= 1
                            ? "가능"
                            : `${availableCount}명`
                          : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
