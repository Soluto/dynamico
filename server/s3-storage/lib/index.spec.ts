import { S3Storage } from '.';
import { Stream } from 'stream';

const getDefaultReturnValue = () => ({
  promise: jest.fn()
});

describe('S3Storage', () => {
  describe('getIndex', () => {
    it('returns empty index when error thrown with code NoSuchKey', async () => {
      const getObjectResponse = getDefaultReturnValue();
      getObjectResponse.promise.mockRejectedValueOnce({ code: 'NoSuchKey' });
      const s3Client: any = {
        getObject: jest.fn().mockReturnValueOnce(getObjectResponse)
      };
      const storage = new S3Storage({
        bucketName: 'someBucket',
        s3Client
      });
      const index = await storage.getIndex();

      expect(index).toEqual({});
    });

    it('returns empty object when index is not found', async () => {
      const getObjectResponse = getDefaultReturnValue();
      getObjectResponse.promise.mockResolvedValueOnce(undefined);
      const s3Client: any = {
        getObject: jest.fn().mockReturnValueOnce(getObjectResponse)
      };
      const storage = new S3Storage({
        bucketName: 'someBucket',
        s3Client
      });
      const index = await storage.getIndex();

      expect(index).toEqual({});
    });

    it('returns empty object when index.Body is not defined', async () => {
      const getObjectResponse = getDefaultReturnValue();
      getObjectResponse.promise.mockResolvedValueOnce({});
      const s3Client: any = {
        getObject: jest.fn().mockReturnValueOnce(getObjectResponse)
      };
      const storage = new S3Storage({
        bucketName: 'someBucket',
        s3Client
      });
      const index = await storage.getIndex();

      expect(index).toEqual({});
    });

    it('throws error when error thrown without code', async () => {
      const expectedError = new Error('some error');
      const getObjectResponse = getDefaultReturnValue();
      getObjectResponse.promise.mockRejectedValueOnce(expectedError);
      const s3Client: any = {
        getObject: jest.fn().mockReturnValueOnce(getObjectResponse)
      };
      const storage = new S3Storage({
        bucketName: 'someBucket',
        s3Client
      });
      await expect(storage.getIndex()).rejects.toEqual(expectedError);
    });

    it('throws error when error thrown with any other code', async () => {
      let expectedError = { message: 'some error', code: 'some code that definitely wont be thrown by S3' };

      const getObjectResponse = getDefaultReturnValue();
      getObjectResponse.promise.mockRejectedValueOnce(expectedError);
      const s3Client: any = {
        getObject: jest.fn().mockReturnValueOnce(getObjectResponse)
      };
      const storage = new S3Storage({
        bucketName: 'someBucket',
        s3Client
      });
      await expect(storage.getIndex()).rejects.toEqual(expectedError);
    });

    it('returns index when index is found', async () => {
      const expectedIndex = {
        'somde id': {
          components: { 'some component': 'some version' },
          dependencies: { 'some dependency': 'dependency version' }
        }
      };
      const result = {
        Body: Buffer.from(JSON.stringify(expectedIndex), 'utf8')
      };
      const getObjectResponse = getDefaultReturnValue();
      getObjectResponse.promise.mockResolvedValueOnce(result);
      const s3Client: any = {
        getObject: jest.fn().mockReturnValueOnce(getObjectResponse)
      };
      const storage = new S3Storage({
        bucketName: 'someBucket',
        s3Client
      });
      const index = await storage.getIndex();
      expect(index).toEqual(expectedIndex);
    });
  });

  describe('upsertIndex', () => {
    it('merges index and uploads to s3 when provided with index', async () => {
      const bucketName = 'someBucket';
      const expectedKey = 'index.json';
      const existingId = 'existing id';
      const existingIndexDefinition = {
        components: { 'some component': 'somen version' },
        dependencies: { 'existing dependency': 'existing version' }
      };
      const newId = 'new id';
      const newIndexDefinition = {
        components: { 'new component': 'new version' },
        dependencies: { 'new dependency': 'new version' }
      };
      const currentIndex = { [existingId]: existingIndexDefinition };
      const newIndex = { [newId]: newIndexDefinition };
      const expectedIndex = { ...currentIndex, ...newIndex };
      const result = {
        Body: Buffer.from(JSON.stringify(currentIndex), 'utf8')
      };
      const getObjectResponse = getDefaultReturnValue();
      getObjectResponse.promise.mockResolvedValueOnce(result);
      const uploadResponse = getDefaultReturnValue();
      const s3Client: any = {
        getObject: jest.fn().mockReturnValueOnce(getObjectResponse),
        upload: jest.fn().mockReturnValueOnce(uploadResponse)
      };
      const storage = new S3Storage({
        bucketName,
        s3Client
      });
      await storage.upsertIndex(newIndex);

      expect(s3Client.upload).toBeCalledWith({
        Bucket: bucketName,
        Key: expectedKey,
        Body: JSON.stringify(expectedIndex)
      });
    });

    it('overrides host id when it already exists', async () => {
      const bucketName = 'someBucket';
      const expectedKey = 'index.json';
      const existingId = 'existing id';
      const existingIndexDefinition = {
        components: { 'some component': 'somen version' },
        dependencies: { 'existing dependency': 'existing version' }
      };

      const newIndexDefinition = {
        components: { 'new component': 'new version' },
        dependencies: { 'new dependency': 'new version' }
      };
      const currentIndex = { [existingId]: existingIndexDefinition };
      const newIndex = { [existingId]: newIndexDefinition };

      const result = {
        Body: Buffer.from(JSON.stringify(currentIndex), 'utf8')
      };
      const getObjectResponse = getDefaultReturnValue();
      getObjectResponse.promise.mockResolvedValueOnce(result);
      const uploadResponse = getDefaultReturnValue();
      const s3Client: any = {
        getObject: jest.fn().mockReturnValueOnce(getObjectResponse),
        upload: jest.fn().mockReturnValueOnce(uploadResponse)
      };
      const storage = new S3Storage({
        bucketName,
        s3Client
      });
      await storage.upsertIndex(newIndex);

      expect(s3Client.upload).toBeCalledWith({
        Bucket: bucketName,
        Key: expectedKey,
        Body: JSON.stringify(newIndex)
      });
    });
  });

  describe('getComponentTree', () => {
    it('returns empty object when listing components returns undefined', async () => {
      const listObjectsV2Response = getDefaultReturnValue();
      listObjectsV2Response.promise.mockResolvedValueOnce(undefined);
      const s3Client: any = {
        listObjectsV2: jest.fn().mockReturnValueOnce(listObjectsV2Response)
      };
      const storage = new S3Storage({
        bucketName: 'someBucket',
        s3Client
      });
      const tree = await storage.getComponentTree();
      expect(tree).toEqual({});
    });

    it('returns empty object when components list has no Contents defined', async () => {
      const listObjectsV2Response = getDefaultReturnValue();
      listObjectsV2Response.promise.mockResolvedValueOnce({});
      const s3Client: any = {
        listObjectsV2: jest.fn().mockReturnValueOnce(listObjectsV2Response)
      };
      const storage = new S3Storage({
        bucketName: 'someBucket',
        s3Client
      });
      const tree = await storage.getComponentTree();
      expect(tree).toEqual({});
    });

    it('creates tree with all components and version when components and versions are listed', async () => {
      const comp1 = 'comp1';
      const comp2 = 'comp2';
      const listObjectsResponse = {
        Contents: [
          { Key: `${comp1}/1.0.0/package.json` },
          { Key: `${comp1}/1.0.0/main.js` },
          { Key: `${comp1}/1.0.1/package.json` },
          { Key: `${comp1}/1.0.1/start.js` },
          { Key: `${comp2}/1.0.0/package.json` },
          { Key: `${comp2}/1.0.0/index.js` }
        ]
      };
      const listObjectsV2Response = getDefaultReturnValue();
      listObjectsV2Response.promise.mockResolvedValueOnce(listObjectsResponse);
      const s3Client: any = {
        listObjectsV2: jest.fn().mockReturnValueOnce(listObjectsV2Response)
      };
      const storage = new S3Storage({
        bucketName: 'someBucket',
        s3Client
      });
      const tree = await storage.getComponentTree();
      expect(tree[comp1]).toBeDefined();
      expect(Object.keys(tree[comp1])).toHaveLength(2);
      expect(tree[comp2]).toBeDefined();
      expect(Object.keys(tree[comp2])).toHaveLength(1);
    });

    it('creates property that uses getObject to get component code when listed', async () => {
      const comp1 = 'comp1';
      const version = '1.0.0';
      const expectedKey = `${comp1}/${version}/package.json`;
      const listObjectsResponse = { Contents: [{ Key: expectedKey }, { Key: `${comp1}/${version}/main.js` }] };
      const peerDeps = { peerDependencies: { someDep: '1.0.0' } };
      const result = {
        Body: Buffer.from(JSON.stringify(peerDeps), 'utf8')
      };
      const listObjectsV2Response = getDefaultReturnValue();
      listObjectsV2Response.promise.mockResolvedValueOnce(listObjectsResponse);
      const getObjectResponse = getDefaultReturnValue();
      getObjectResponse.promise.mockResolvedValueOnce(result);
      const bucketName = 'someBucket';
      const s3Client: any = {
        listObjectsV2: jest.fn().mockReturnValueOnce(listObjectsV2Response),
        getObject: jest.fn().mockReturnValueOnce(getObjectResponse)
      };
      const storage = new S3Storage({
        bucketName,
        s3Client
      });
      const tree = await storage.getComponentTree();
      expect(tree[comp1]).toBeDefined();
      expect(Object.keys(tree[comp1])).toHaveLength(1);

      const deps = await tree[comp1][version]();
      expect(deps).toEqual(peerDeps.peerDependencies);
      expect(s3Client.getObject).toHaveBeenCalledWith({ Bucket: bucketName, Key: expectedKey });
    });

    it('returns undefined when package json Object is not defined for component', async () => {
      const comp1 = 'comp1';
      const version = '1.0.0';
      const expectedKey = `${comp1}/${version}/package.json`;
      const listObjectsReturnValue = { Contents: [{ Key: expectedKey }, { Key: `${comp1}/${version}/main.js` }] };
      const listObjectsV2Response = getDefaultReturnValue();
      listObjectsV2Response.promise.mockResolvedValueOnce(listObjectsReturnValue);
      const getObjectResult = getDefaultReturnValue();
      getObjectResult.promise.mockResolvedValueOnce(undefined);
      const bucketName = 'someBucket';
      const s3Client: any = {
        listObjectsV2: jest.fn().mockReturnValueOnce(listObjectsV2Response),
        getObject: jest.fn().mockReturnValueOnce(getObjectResult)
      };
      const storage = new S3Storage({
        bucketName,
        s3Client
      });
      const tree = await storage.getComponentTree();
      expect(tree[comp1]).toBeDefined();
      expect(Object.keys(tree[comp1])).toHaveLength(1);

      const deps = await tree[comp1][version]();
      expect(deps).toEqual(undefined);
    });

    it('returns undefined when package json Object has no Body property defined', async () => {
      const comp1 = 'comp1';
      const version = '1.0.0';
      const expectedKey = `${comp1}/${version}/package.json`;
      const listObjectsReturnValue = { Contents: [{ Key: expectedKey }, { Key: `${comp1}/${version}/main.js` }] };
      const listObjectsV2Response = getDefaultReturnValue();
      listObjectsV2Response.promise.mockResolvedValueOnce(listObjectsReturnValue);
      const getObjectResult = getDefaultReturnValue();
      getObjectResult.promise.mockResolvedValueOnce({});
      const bucketName = 'someBucket';
      const s3Client: any = {
        listObjectsV2: jest.fn().mockReturnValueOnce(listObjectsV2Response),
        getObject: jest.fn().mockReturnValueOnce(getObjectResult)
      };
      const storage = new S3Storage({
        bucketName,
        s3Client
      });
      const tree = await storage.getComponentTree();
      expect(tree[comp1]).toBeDefined();
      expect(Object.keys(tree[comp1])).toHaveLength(1);

      const deps = await tree[comp1][version]();
      expect(deps).toEqual(undefined);
    });
  });

  describe('getComponent', () => {
    it('returns undefined when packageJson returns undefined', async () => {
      const bucketName = 'someBucket';
      const componentName = 'some component';
      const componentVersion = 'some version';

      const getObjectResponse = getDefaultReturnValue();
      getObjectResponse.promise.mockResolvedValueOnce(undefined);

      const s3Client: any = {
        getObject: jest.fn().mockReturnValueOnce(getObjectResponse)
      };

      const storage = new S3Storage({
        bucketName,
        s3Client
      });

      const component = await storage.getComponent(componentName, componentVersion);
      expect(component).toBeUndefined();
    });

    it('returns undefined when packageJson Object has no Body defined', async () => {
      const bucketName = 'someBucket';
      const componentName = 'some component';
      const componentVersion = 'some version';

      const getObjectResponse = getDefaultReturnValue();
      getObjectResponse.promise.mockResolvedValueOnce({});

      const s3Client: any = {
        getObject: jest.fn().mockReturnValueOnce(getObjectResponse)
      };

      const storage = new S3Storage({
        bucketName,
        s3Client
      });

      const component = await storage.getComponent(componentName, componentVersion);
      expect(component).toBeUndefined();
    });

    it('returns empty string when getting code and code Object is undefined', async () => {
      const bucketName = 'someBucket';
      const componentName = 'some component';
      const componentVersion = 'some version';
      const componentCode = 'some code';
      const mainFile = 'some file';
      const packageJson = {
        main: mainFile
      };
      const getPackageJsonResponse = {
        Body: JSON.stringify(packageJson)
      };
      const getObjectResponse = getDefaultReturnValue();
      getObjectResponse.promise.mockResolvedValueOnce(getPackageJsonResponse);

      const getComponentObjectResponse = getDefaultReturnValue();
      getComponentObjectResponse.promise.mockResolvedValueOnce(undefined);
      const s3Client: any = {
        getObject: jest
          .fn()
          .mockReturnValueOnce(getObjectResponse)
          .mockReturnValueOnce(getComponentObjectResponse)
      };

      const storage = new S3Storage({
        bucketName,
        s3Client
      });

      const component = await storage.getComponent(componentName, componentVersion);
      if (!component) {
        expect(component).toBeDefined();
        return;
      }
      expect(component.name).toEqual(componentName);
      expect(component.version).toEqual(componentVersion);

      const code = await component.getCode();
      expect(code).toBe('');
    });

    it('returns empty string when getting code and code Object has no Body defined', async () => {
      const bucketName = 'someBucket';
      const componentName = 'some component';
      const componentVersion = 'some version';
      const componentCode = 'some code';
      const mainFile = 'some file';
      const packageJson = {
        main: mainFile
      };
      const getPackageJsonResponse = {
        Body: JSON.stringify(packageJson)
      };
      const getObjectResponse = getDefaultReturnValue();
      getObjectResponse.promise.mockResolvedValueOnce(getPackageJsonResponse);

      const getComponentObjectResponse = getDefaultReturnValue();
      getComponentObjectResponse.promise.mockResolvedValueOnce({});
      const s3Client: any = {
        getObject: jest
          .fn()
          .mockReturnValueOnce(getObjectResponse)
          .mockReturnValueOnce(getComponentObjectResponse)
      };

      const storage = new S3Storage({
        bucketName,
        s3Client
      });

      const component = await storage.getComponent(componentName, componentVersion);
      if (!component) {
        expect(component).toBeDefined();
        return;
      }
      expect(component.name).toEqual(componentName);
      expect(component.version).toEqual(componentVersion);

      const code = await component.getCode();
      expect(code).toBe('');
    });

    it('returns component when available', async () => {
      const bucketName = 'someBucket';
      const componentName = 'some component';
      const componentVersion = 'some version';
      const componentCode = 'some code';
      const mainFile = 'some file';
      const packageJson = {
        main: mainFile
      };
      const getPackageJsonResponse = {
        Body: JSON.stringify(packageJson)
      };
      const getObjectResponse = getDefaultReturnValue();
      getObjectResponse.promise.mockResolvedValueOnce(getPackageJsonResponse);

      const getComponentCodeResponse = {
        Body: Buffer.from(componentCode, 'utf8')
      };
      const getComponentObjectResponse = getDefaultReturnValue();
      getComponentObjectResponse.promise.mockResolvedValueOnce(getComponentCodeResponse);
      const s3Client: any = {
        getObject: jest
          .fn()
          .mockReturnValueOnce(getObjectResponse)
          .mockReturnValueOnce(getComponentObjectResponse)
      };

      const storage = new S3Storage({
        bucketName,
        s3Client
      });

      const component = await storage.getComponent(componentName, componentVersion);
      if (!component) {
        expect(component).toBeDefined();
        return;
      }
      expect(component.name).toEqual(componentName);
      expect(component.version).toEqual(componentVersion);

      const code = await component.getCode();
      expect(code).toEqual(componentCode);
      expect(s3Client.getObject).toBeCalledWith({
        Bucket: bucketName,
        Key: `${componentName}/${componentVersion}/${mainFile}`
      });
    });
  });

  describe('saveComponent', () => {
    it('returns without saving when no files are provided', async () => {
      const s3Client: any = {
        upload: jest.fn()
      };

      const storage = new S3Storage({
        s3Client,
        bucketName: 'someBucket'
      });
      await storage.saveComponent({ name: 'someName' }, []);

      expect(s3Client.upload).not.toBeCalled();
    });

    it('throws error when no file named package.json exists', async () => {
      const s3Client: any = {
        upload: jest.fn()
      };

      const storage = new S3Storage({
        s3Client,
        bucketName: 'someBucket'
      });
      await expect(
        storage.saveComponent({ name: 'someName' }, [{ name: 'notPackageJson', stream: new Stream() }])
      ).rejects.toEqual(new Error('Missing package.json file'));

      expect(s3Client.upload).not.toBeCalled();
    });

    it('uploads files when streams and package json file are available', async () => {
      const bucketName = 'someBucket';
      const componentName = 'some component';
      const componentVersion = 'some version';
      const packageJsonFileName = 'package.json';
      const packageJsonFileStream = new Stream();
      const packageJsonFile = {
        name: packageJsonFileName,
        stream: packageJsonFileStream
      };
      const mainFileName = 'mainFile';
      const mainFileStream = new Stream();
      const mainFile = {
        name: mainFileName,
        stream: mainFileStream
      };
      const expectedKey = `${componentName}/${componentVersion}`;
      const s3Client: any = {
        upload: jest.fn()
      };
      const uploadResponse = getDefaultReturnValue();
      uploadResponse.promise.mockResolvedValueOnce('some value');
      s3Client.upload.mockReturnValueOnce(uploadResponse).mockReturnValueOnce(uploadResponse);
      const storage = new S3Storage({
        s3Client,
        bucketName
      });
      await storage.saveComponent({ name: componentName, version: componentVersion }, [packageJsonFile, mainFile]);

      expect(s3Client.upload).toBeCalledWith({
        Bucket: bucketName,
        Key: `${expectedKey}/${packageJsonFileName}`,
        Body: packageJsonFileStream
      });

      expect(s3Client.upload).toBeCalledWith({
        Bucket: bucketName,
        Key: `${expectedKey}/${mainFileName}`,
        Body: mainFileStream
      });
    });
  });
});
