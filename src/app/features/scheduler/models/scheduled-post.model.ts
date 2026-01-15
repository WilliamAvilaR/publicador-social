// Modelos para publicaciones programadas

export interface ScheduledPost {
  id: string;
  content: string;
  mediaUrl?: string;
  scheduledDate: Date | string;
  socialNetwork: 'facebook' | 'instagram' | 'twitter';
  accountId: string;
  accountName: string;
  pageId?: string;
  pageName?: string;
  status: 'scheduled' | 'published' | 'failed';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ScheduledPostEvent {
  id: string;
  title: string;
  start: Date | string;
  end?: Date | string;
  allDay?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  extendedProps: {
    postId: string;
    content: string;
    mediaUrl?: string;
    socialNetwork: 'facebook' | 'instagram' | 'twitter';
    accountId: string;
    accountName: string;
    pageId?: string;
    pageName?: string;
    status: 'scheduled' | 'published' | 'failed';
  };
}

export interface CreateScheduledPostRequest {
  content: string;
  mediaUrl?: string;
  scheduledDate: Date | string;
  socialNetwork: 'facebook' | 'instagram' | 'twitter';
  accountId: string;
  pageId?: string;
}

export interface UpdateScheduledPostRequest {
  content?: string;
  mediaUrl?: string;
  scheduledDate?: Date | string;
  socialNetwork?: 'facebook' | 'instagram' | 'twitter';
}
