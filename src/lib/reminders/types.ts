export type ReminderOffset = {
  id: string;
  minutesBefore: number;
  label: string;
};

export type Reminder = {
  id: string;
  contestId: string;
  minutesBefore: number;
  remindAt: Date;
  sentAt: Date | null;
};
