import PocketBase from 'pocketbase';

const pb = new PocketBase('http://xboomx.ddns.net:8090');

export const db = pb;
export const auth = pb.auth;
export const storage = pb.files;

export const uploadImage = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('image', file);
  
  const record = await pb.collection('images').create(formData);
  return pb.files.getUrl(record, record.image);
};