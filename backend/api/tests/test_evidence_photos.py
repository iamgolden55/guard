"""Photo evidence for checks and incident reports is kept, privately.

Until this existed no photo was ever kept: the app tried to put a venue-check
photo itself into a 500-character URL field (and failed on the phone first,
Sentry REACT-NATIVE-P), and incident photos were only paths on the officer's
own phone. Photos are now uploaded on their own and referred to by URL.

These pin what is accepted, who may see a photo, and that a check or report
may only use photos its own author uploaded for the same company.
"""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from api.models import IncidentReport, SecurityCompany, Shift, ToiletCheck, UserCompanyMembership, Venue

User = get_user_model()

IN_MEMORY_STORAGE = {
    'default': {'BACKEND': 'django.core.files.storage.InMemoryStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}
JPEG = b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00' + b'\x00' * 64
PNG = b'\x89PNG\r\n\x1a\n' + b'\x00' * 64
UPLOAD = '/api/v1/evidence-photos/'


@override_settings(
    STORAGES=IN_MEMORY_STORAGE, MEDIA_STORAGE_IS_DURABLE=True, ALLOWED_HOSTS=['api.meadsecurity.test'],
)
class EvidencePhotoTests(APITestCase):
    def setUp(self):
        self.company = SecurityCompany.objects.create(name='Bull Co', registration_number='EV001')
        self.other_company = SecurityCompany.objects.create(name='Other Co', registration_number='EV002')
        self.officer = self._member('ev_officer', 'staff', self.company)
        self.colleague = self._member('ev_colleague', 'staff', self.company)
        self.manager = self._member('ev_manager', 'manager', self.company)
        self.outside_manager = self._member('ev_outsider', 'manager', self.other_company)
        self.venue = Venue.objects.create(
            company=self.company, name='Bull Dogs', address='1 St', city='Bristol',
            postal_code='BS1', country='UK', capacity=100, contact_name='C',
            contact_phone='07700900000', contact_email='bull@venue.test', terms_and_conditions='T',
        )
        start = timezone.now() - timedelta(minutes=10)
        self.shift = Shift.objects.create(
            staff_user=self.officer, venue=self.venue, start_time=start,
            end_time=start + timedelta(hours=5), status='in_progress', is_published=True,
        )
        # A real host name: stored URLs are absolute and must pass URL
        # validation, which the default "testserver" does not.
        self.client = APIClient(SERVER_NAME='api.meadsecurity.test')

    def _member(self, username, role, company):
        user = User.objects.create_user(
            username=username, email=f'{username}@test.test', password='testpass123', role=role,
        )
        UserCompanyMembership.objects.create(
            user=user, company=company, is_active=True, role='staff' if role == 'staff' else 'manager',
        )
        return user

    def _upload(self, user, content=JPEG, name='photo.jpg', content_type='image/jpeg'):
        self.client.force_authenticate(user)
        return self.client.post(
            UPLOAD, {'file': SimpleUploadedFile(name, content, content_type=content_type)},
            format='multipart',
        )

    def _path(self, url):
        return url.split('api.meadsecurity.test', 1)[-1]

    # -- upload ---------------------------------------------------------------

    def test_a_jpeg_is_stored_under_the_company_and_uploader(self):
        response = self._upload(self.officer)
        self.assertEqual(response.status_code, 201, response.data)
        url = response.data['url']
        prefix = f'/api/v1/evidence-photos/{self.company.id}/{self.officer.id}/'
        self.assertIn(prefix, url)
        key = 'evidence/' + url.split('/api/v1/evidence-photos/', 1)[1]
        self.assertTrue(default_storage.exists(key))
        self.assertLessEqual(len(url), 500)

    def test_a_png_is_accepted(self):
        response = self._upload(self.officer, PNG, 'p.png', 'image/png')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(response.data['url'].endswith('.png'))

    def test_the_type_comes_from_the_bytes(self):
        response = self._upload(self.officer, b'<html><script>alert(1)</script>', 'photo.jpg', 'image/jpeg')
        self.assertEqual(response.status_code, 400)

    def test_a_photo_over_10mb_is_refused(self):
        response = self._upload(self.officer, JPEG + b'\x00' * (10 * 1024 * 1024))
        self.assertEqual(response.status_code, 400)

    @override_settings(MEDIA_STORAGE_IS_DURABLE=False)
    def test_refused_when_storage_would_forget_it(self):
        self.assertEqual(self._upload(self.officer).status_code, 503)

    def test_refused_without_a_company(self):
        loner = User.objects.create_user(username='ev_loner', email='l@test.test', password='x', role='staff')
        self.assertEqual(self._upload(loner).status_code, 403)

    # -- viewing --------------------------------------------------------------

    def _get(self, user, path):
        self.client.force_authenticate(user)
        return self.client.get(path)

    def test_the_uploader_and_their_manager_can_see_it(self):
        path = self._path(self._upload(self.officer).data['url'])
        for user in (self.officer, self.manager):
            response = self._get(user, path)
            self.assertEqual(response.status_code, 200, user.username)
            self.assertEqual(response['Content-Type'], 'image/jpeg')
            self.assertEqual(response['Cache-Control'], 'private, no-store')
            self.assertEqual(b''.join(response.streaming_content), JPEG)

    def test_nobody_else_can(self):
        path = self._path(self._upload(self.officer).data['url'])
        for user in (self.colleague, self.outside_manager):
            self.assertEqual(self._get(user, path).status_code, 404, user.username)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(path).status_code, 401)

    def test_malformed_and_climbing_paths_are_not_found(self):
        base = f'/api/v1/evidence-photos/{self.company.id}/{self.officer.id}/'
        for tail in ('../../sia_licenses/1/x.jpg', 'x.jpg', 'a' * 32 + '.html'):
            self.assertEqual(self._get(self.officer, base + tail).status_code, 404, tail)

    # -- venue checks ---------------------------------------------------------

    def _toilet_check(self, user, photo):
        self.client.force_authenticate(user)
        return self.client.post('/api/v1/toilet-checks/', {
            'shift': self.shift.id, 'location_name': 'Gents', 'condition': 'poor',
            'photo_evidence': photo,
        }, format='json')

    def test_a_check_keeps_its_own_photo(self):
        url = self._upload(self.officer).data['url']
        response = self._toilet_check(self.officer, url)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(ToiletCheck.objects.get().photo_evidence, url)

    def test_a_check_cannot_use_someone_elses_photo(self):
        theirs = self._upload(self.manager).data['url']
        self.assertEqual(self._toilet_check(self.officer, theirs).status_code, 400)

    def test_a_check_cannot_use_another_companys_photo(self):
        foreign = f'https://api.test/api/v1/evidence-photos/{self.other_company.id}/{self.officer.id}/{"a" * 32}.jpg'
        self.assertEqual(self._toilet_check(self.officer, foreign).status_code, 400)

    def test_a_check_cannot_point_anywhere_else(self):
        response = self._toilet_check(self.officer, 'https://example.com/cat.jpg')
        self.assertEqual(response.status_code, 400)
        self.assertIn('photo_evidence', response.data)

    def test_a_check_without_a_photo_still_saves(self):
        self.client.force_authenticate(self.officer)
        response = self.client.post('/api/v1/toilet-checks/', {
            'shift': self.shift.id, 'location_name': 'Gents', 'condition': 'good',
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)

    # -- incident reports -----------------------------------------------------

    def _incident(self, user, photos):
        self.client.force_authenticate(user)
        return self.client.post('/api/v1/incidents/', {
            'venue': self.venue.id, 'shift': self.shift.id,
            'incident_time': timezone.now().isoformat(),
            'description': 'Fight at the door', 'severity': 'medium', 'photos': photos,
        }, format='json')

    def test_a_report_keeps_its_photos(self):
        urls = [self._upload(self.officer).data['url'] for _ in range(2)]
        response = self._incident(self.officer, urls)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(IncidentReport.objects.get().photos, urls)
        self.assertEqual(response.data['photos'], urls)

    def test_a_report_without_photos_reads_back_an_empty_list(self):
        self.client.force_authenticate(self.officer)
        response = self.client.post('/api/v1/incidents/', {
            'venue': self.venue.id, 'shift': self.shift.id,
            'incident_time': timezone.now().isoformat(),
            'description': 'Quiet night', 'severity': 'low',
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['photos'], [])

    def test_a_report_cannot_use_someone_elses_photo(self):
        theirs = self._upload(self.colleague).data['url']
        self.assertEqual(self._incident(self.officer, [theirs]).status_code, 400)

    def test_a_report_has_at_most_ten_photos(self):
        url = self._upload(self.officer).data['url']
        self.assertEqual(self._incident(self.officer, [url] * 11).status_code, 400)
