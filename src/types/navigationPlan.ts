import { Stop, RouteOption } from './trip';
import { RoutePreference } from './preference';

export interface NavigationLeg {
  legIndex: number; // 1-indexed (1..N)
  segmentId: string;
  day: number;
  title: string;
  startStop: Stop;
  endStop: Stop;
  chosenOption: RouteOption;
  orderedWaypoints: Stop[];
  distanceMeters: number;
  durationSeconds: number;
  tolls: number;
  roads: string[];
  isCompleted?: boolean;
}

export interface TripNavigationPlan {
  legs: NavigationLeg[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  totalTolls: number;
  totalDays: number;
  preference: RoutePreference;
  generatedAt: string;
}
