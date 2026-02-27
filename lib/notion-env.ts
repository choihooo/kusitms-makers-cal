export type NotionEnv = {
  projectsDbId: string;
  issuesDbId: string;
  sprintsDbId: string;
  releasesDbId: string;
};

export type NotionOAuthEnv = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

export function getNotionEnv(): NotionEnv {
  return {
    projectsDbId: required("NOTION_PROJECTS_DB_ID"),
    issuesDbId: required("NOTION_ISSUES_DB_ID"),
    sprintsDbId: required("NOTION_SPRINTS_DB_ID"),
    releasesDbId: required("NOTION_RELEASES_DB_ID")
  };
}

export function getNotionOAuthEnv(): NotionOAuthEnv {
  return {
    clientId: required("NOTION_CLIENT_ID"),
    clientSecret: required("NOTION_CLIENT_SECRET"),
    redirectUri: required("NOTION_REDIRECT_URI")
  };
}
