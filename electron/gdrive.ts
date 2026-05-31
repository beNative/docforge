import http from 'http';
import url from 'url';
import fs from 'fs/promises';
import { databaseService } from './database';

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

interface UserInfoResponse {
  email: string;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  md5Checksum: string;
}

interface DriveSearchResponse {
  files: DriveFile[];
}

export class GoogleDriveService {
  private static PORT = 52080;
  private static REDIRECT_URI = `http://127.0.0.1:${GoogleDriveService.PORT}`;
  
  // Refreshes the access token using the stored refresh token
  static async refreshAccessToken(
    clientId: string,
    clientSecret: string,
    refreshToken: string
  ): Promise<{ accessToken: string; expiresIn: number }> {
    console.log('[Sync] Refreshing Google OAuth access token...');
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('refresh_token', refreshToken);
    params.append('grant_type', 'refresh_token');

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Sync] Failed to refresh token:', errText);
      throw new Error(`Failed to refresh access token: ${res.statusText} (${errText})`);
    }

    const data = (await res.json()) as TokenResponse;
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  }

  // Connect / Authenticate OAuth2 flow
  static startOAuthFlow(
    clientId: string,
    clientSecret: string,
    onSuccess: (tokens: { accessToken: string; refreshToken: string; email: string }) => void,
    onFailure: (error: string) => void
  ): { authUrl: string; closeServer: () => void } {
    console.log('[Sync] Starting Google OAuth local listener server...');
    
    const scopes = [
      'https://www.googleapis.com/auth/drive.appdata',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' ');

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `redirect_uri=${encodeURIComponent(this.REDIRECT_URI)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `access_type=offline&` +
      `prompt=consent`;

    let server: http.Server | null = null;

    const closeServer = () => {
      if (server) {
        server.close(() => {
          console.log('[Sync] OAuth server closed.');
        });
        server = null;
      }
    };

    server = http.createServer(async (req, res) => {
      const parsedUrl = url.parse(req.url ?? '', true);
      const code = parsedUrl.query.code as string | undefined;
      const error = parsedUrl.query.error as string | undefined;

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>Authentication Failed</h1><p>Error received from Google.</p>');
        onFailure(error);
        closeServer();
        return;
      }

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>Bad Request</h1><p>Missing authorization code.</p>');
        return;
      }

      try {
        // Exchange code for tokens
        const tokenParams = new URLSearchParams();
        tokenParams.append('code', code);
        tokenParams.append('client_id', clientId);
        tokenParams.append('client_secret', clientSecret);
        tokenParams.append('redirect_uri', this.REDIRECT_URI);
        tokenParams.append('grant_type', 'authorization_code');

        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: tokenParams.toString(),
        });

        if (!tokenRes.ok) {
          throw new Error(`Token exchange failed: ${tokenRes.statusText}`);
        }

        const tokenData = (await tokenRes.json()) as TokenResponse;
        if (!tokenData.refresh_token) {
          throw new Error('No refresh token returned. Try removing DocForge permissions from your Google Account settings and re-connect.');
        }

        // Fetch User Email
        const emailRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
          },
        });

        if (!emailRes.ok) {
          throw new Error(`Failed to fetch user email: ${emailRes.statusText}`);
        }

        const emailData = (await emailRes.json()) as UserInfoResponse;

        // Render success page to the user in their browser
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>DocForge Authorized</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; padding: 50px; background: #121212; color: #e0e0e0; }
              .card { max-width: 500px; margin: auto; padding: 30px; border-radius: 12px; background: #1e1e1e; border: 1px solid #333; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
              h1 { color: #4caf50; margin-top: 0; }
              p { color: #b0b0b0; line-height: 1.5; }
              .email { font-weight: bold; color: #2196f3; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>Successfully Connected!</h1>
              <p>DocForge has been linked to <span class="email">${emailData.email}</span>.</p>
              <p>You can now close this tab and return to the application.</p>
            </div>
          </body>
          </html>
        `);

        onSuccess({
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          email: emailData.email,
        });

      } catch (err: any) {
        console.error('[Sync] OAuth token exchange error:', err);
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`<h1>Authorization Error</h1><p>${err.message}</p>`);
        onFailure(err.message);
      } finally {
        closeServer();
      }
    });

    server.listen(this.PORT, '127.0.0.1', () => {
      console.log(`[Sync] OAuth local server listening on 127.0.0.1:${this.PORT}`);
    });

    return { authUrl, closeServer };
  }

  // Find file in Google Drive AppData folder
  static async findDatabaseFile(accessToken: string): Promise<DriveFile | null> {
    console.log('[Sync] Searching for docforge.db in Google Drive appDataFolder...');
    const url = 'https://www.googleapis.com/drive/v3/files?' +
      `q=${encodeURIComponent("name='docforge.db' and 'appDataFolder' in parents")}&` +
      `spaces=appDataFolder&` +
      `fields=${encodeURIComponent('files(id,name,mimeType,modifiedTime,md5Checksum)')}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Sync] Find database file failed:', errText);
      throw new Error(`Drive search failed: ${res.statusText}`);
    }

    const data = (await res.json()) as DriveSearchResponse;
    if (data.files && data.files.length > 0) {
      console.log(`[Sync] Found cloud file with ID: ${data.files[0].id}, MD5: ${data.files[0].md5Checksum}`);
      return data.files[0];
    }
    console.log('[Sync] No database file found in Google Drive appDataFolder.');
    return null;
  }

  // Upload file (Create)
  static async uploadDatabaseFile(
    accessToken: string,
    localFilePath: string
  ): Promise<DriveFile> {
    console.log('[Sync] Creating database file in Google Drive appDataFolder...');
    const fileBuffer = await fs.readFile(localFilePath);
    
    const metadata = JSON.stringify({
      name: 'docforge.db',
      parents: ['appDataFolder'],
    });

    const boundary = 'docforge_multipart_boundary';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--\r\n`;

    const header = delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      metadata +
      delimiter +
      'Content-Type: application/octet-stream\r\n\r\n';

    const headerBuffer = Buffer.from(header, 'utf-8');
    const footerBuffer = Buffer.from(closeDelimiter, 'utf-8');
    const bodyBuffer = Buffer.concat([headerBuffer, fileBuffer, footerBuffer]);

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,md5Checksum', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: bodyBuffer as any,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Sync] Upload database file failed:', errText);
      throw new Error(`Drive upload failed: ${res.statusText} (${errText})`);
    }

    const data = (await res.json()) as DriveFile;
    console.log('[Sync] Database file uploaded successfully. ID:', data.id);
    return data;
  }

  // Update file (Overwrite content)
  static async updateDatabaseFile(
    accessToken: string,
    fileId: string,
    localFilePath: string
  ): Promise<DriveFile> {
    console.log(`[Sync] Updating database file ${fileId} in Google Drive...`);
    const fileBuffer = await fs.readFile(localFilePath);

    const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&fields=id,name,mimeType,modifiedTime,md5Checksum`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
      },
      body: fileBuffer as any,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Sync] Update database file failed:', errText);
      throw new Error(`Drive patch failed: ${res.statusText} (${errText})`);
    }

    const data = (await res.json()) as DriveFile;
    console.log('[Sync] Database file updated successfully. MD5:', data.md5Checksum);
    return data;
  }

  // Download file
  static async downloadDatabaseFile(
    accessToken: string,
    fileId: string,
    destinationPath: string
  ): Promise<void> {
    console.log(`[Sync] Downloading database file ${fileId} to ${destinationPath}...`);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Sync] Download database file failed:', errText);
      throw new Error(`Drive download failed: ${res.statusText}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    await fs.writeFile(destinationPath, Buffer.from(arrayBuffer));
    console.log('[Sync] Database file downloaded successfully.');
  }
}
