import { NextResponse } from 'next/server';
import { S3Client, ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const BUCKET = process.env.R2_BUCKET_NAME!;
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID!;
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY!;

const PUBLIC_BASE =process.env.ENDPOINT_BUCKET;

if (!BUCKET || !ACCESS_KEY || !SECRET_KEY) {
  console.warn('R2 env vars are not fully set. Set R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY');
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.ENDPOINT_BUCKET,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get('key');
    if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });

    const provided = req.headers.get('x-api-key') ?? '';
    const expected = process.env.TOKEN_VALUE ?? process.env.IMAGES_API_KEY ?? '';
    if (expected && provided !== expected) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const keyRegex = /^images\/[A-Za-z0-9\-_.]+?\.[a-z0-9]{1,6}$/i;
    if (!keyRegex.test(key)) return NextResponse.json({ error: 'invalid key format' }, { status: 400 });

    const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const signedUrl = await getSignedUrl(s3, cmd, { expiresIn: 60 });

    return NextResponse.json({ key, signedUrl }, { status: 200 });
  } catch (err: any) {
    console.error('GET /api/images/get error', err);
    return NextResponse.json({ error: err?.message ?? 'internal' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { key, contentType = 'application/octet-stream', expiresIn = 60 } = body || {};

    if (!key) return NextResponse.json({ error: 'Key is required' }, { status: 400 });

    const cmd = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
    });

    const signedUrl = await getSignedUrl(s3, cmd, { expiresIn: Number(expiresIn) });

    return NextResponse.json({ key, signedUrl, publicUrl: `${PUBLIC_BASE}/${encodeURIComponent(key)}` }, { status: 201 });
  } catch (err: any) {
    console.error('POST /api/images error', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

// UPDATE (PUT) - genera presigned URL para sobrescribir un objeto existente (o crear de nuevo)
// body: { key: string, contentType?: string, expiresIn?: number }
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { key, contentType = 'application/octet-stream', expiresIn = 60 } = body || {};

    if (!key) return NextResponse.json({ error: 'Key is required' }, { status: 400 });

    // Igual que POST: un presigned PUT para sobrescribir
    const cmd = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
    });

    const signedUrl = await getSignedUrl(s3, cmd, { expiresIn: Number(expiresIn) });

    return NextResponse.json({ key, signedUrl, publicUrl: `${PUBLIC_BASE}/${encodeURIComponent(key)}` }, { status: 200 });
  } catch (err: any) {
    console.error('PUT /api/images error', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { key } = await request.json();
    if (!key) return NextResponse.json({ error: 'Key is required' }, { status: 400 });

    const cmd = new DeleteObjectCommand({ Bucket: BUCKET, Key: key });
    await s3.send(cmd);

    return NextResponse.json({ message: 'Deleted', key }, { status: 200 });
  } catch (err: any) {
    console.error('DELETE /api/images error', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
